# query.py
# ─────────────────────────────────────────────────────────────────────────────
# Google Gemini-2.5-flash RAG 엔진 최적화 + 실시간 스트리밍 버전
# (하이브리드 BM25 + Vector Search 융합 및 5턴 연속 대화 메모리 탑재)
# ─────────────────────────────────────────────────────────────────────────────

import os
import re
import sys
import time
import pickle
from typing import List

from dotenv import load_dotenv

# stdout 인코딩 재설정 (윈도우 터미널 한글 출력 깨짐 방지)
try:
    if sys.stdout.encoding != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")
except AttributeError:
    pass

# .env 절대 경로 기반 안전 로드
current_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(current_dir, "../.env")
load_dotenv(dotenv_path)

from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.prompts import PromptTemplate

# 하이브리드 검색을 위한 패키지 임포트
from langchain_classic.retrievers import EnsembleRetriever as LangChainEnsembleRetriever
from langchain_community.retrievers import BM25Retriever

# 공통 설정 및 유틸리티 임포트
import config
from utils import kiwi_tokenize, get_all_documents_from_chroma

# ── 상수 ──────────────────────────────────────────────────────────────────
LLM_MODEL = "gemini-2.5-flash"


# ── RAG 프롬프트 정의 ──────────────────────────────────────────────────────
# 시공/법규/체크리스트 질문에 대해 컨설턴트 입장으로 안내하는 템플릿입니다.
RAG_TEMPLATE = """\
당신은 고객의 인테리어 프로젝트를 담당하는 전문 컨설턴트입니다.
회사가 보유한 [참고 문서](시공 기준, 법규, 체크리스트 데이터)를 바탕으로 고객에게 정확하고 신뢰할 수 있는 정보를 친절하게 안내하는 것이 당신의 역할입니다.

[답변 규칙]
1. 반드시 [참고 문서]에 명시된 사실 정보만을 근거로 답변하십시오. 문서에 없는 내용을 임의로 만들어내지 마십시오.
2. 시공 기준, 법규, 체크리스트 내용을 고객이 이해하기 쉬운 친절한 한국어 대화체(~입니다, ~확인해 주세요, ~권장드립니다)로 안내하십시오.
3. 핵심 내용 위주로 3~5문장 이내로 간결하게 전달하십시오.
4. [참고 문서]에서 관련 내용을 찾을 수 없는 경우, 추측하거나 지어내지 말고 "해당 내용은 현재 보유한 자료에서 확인이 어렵습니다. 추가 상담이 필요하시면 말씀해 주세요"라고 안내하십시오.
5. "참고 문서에 따르면", "문서에 의하면" 등 출처를 직접 언급하는 서두 문구 없이 바로 본론부터 자연스럽게 안내하십시오.
6. [이전 대화 기록]에서 이미 안내한 내용은 반복하지 말고, 고객의 최신 질문에 집중하여 새로운 정보만 추가로 제공하십시오.

[이전 대화 기록]
{chat_history}

[참고 문서]
{context}

[고객 질문]
{question}

[컨설턴트 답변]"""

# [추가] 이전 대화 맥락과 최신 질문을 결합하여 독립된 RAG 검색 질문을 만드는 템플릿입니다.
CONDENSE_QUESTION_TEMPLATE = """\
이전 대화 기록과 최신 질문을 기반으로, 이전 대화 맥락을 포함하는 독립적인 검색용 질문을 한국어로 생성하십시오.
검색기가 ChromaDB에서 관련 내용을 정확하게 찾아낼 수 있도록 명사를 살려 온전한 질문 문장으로 만드십시오.
어떠한 설명이나 다른 단어도 덧붙이지 말고 오직 재구성된 질문 하나만 반환하십시오.

[이전 대화 기록]
{chat_history}

[최신 질문]
{question}

[재구성된 질문]"""


# ── 질문 유형 라우터 템플릿 ─────────────────────────────────────────────────
# 사용자의 질문이 취향/스타일 조언인지, 시공/법규 정보 안내인지 판별합니다.
ROUTE_TEMPLATE = """\
사용자의 질문이 아래 '취향/디자인 조언' 카테고리에 해당하는지 판단하십시오:

[취향/디자인 조언 카테고리 해당 예시]
- 인테리어 스타일 추천 (모던, 북유럽, 미니멀, 빈티지, 내추럴, 재팬디 등)
- 소파, 가구, 조명, 커튼, 소품의 컬러·소재·배치 추천
- 공간별(거실, 침실, 주방 등) 분위기 연출 및 색상 조합 조언
- 홈 스타일링, 인테리어 트렌드, 디자인 아이디어 요청
- "어울리는", "추천해줘", "어떤 게 좋아" 같은 주관적 선호 관련 질문

위 카테고리에 해당하면 'true', 시공 방법·법규·하자 판정·공정 순서 등 객관적 기술 정보 질문이면 'false'만 답하십시오.
어떠한 부연 설명도 덧붙이지 마십시오.

[사용자 질문]
{question}

[판단 결과]"""

# ── 취향/스타일 컨설팅 전용 템플릿 ──────────────────────────────────────────
# 인테리어 취향·스타일 관련 질문에 대해 DB 데이터 기반으로 컨설팅 답변을 생성합니다.
PREFERENCE_TEMPLATE = """\
당신은 고객의 인테리어 취향과 라이프스타일에 맞는 스타일을 제안하는 인테리어 취향 전문 컨설턴트입니다.
회사가 보유한 [참고 데이터](스타일별 컬러·분위기·자재 특징 데이터)를 정밀 분석하여, 고객이 원하는 공간에 딱 맞는 구체적인 인테리어 조언을 제공하는 것이 당신의 역할입니다.

[절대 준수 답변 규칙]
1. [참고 데이터]에 해당 스타일의 특징(색상, 분위기, 감성, 자재 등)이 하나라도 있다면, 그것을 근거로 소파 컬러·가구 선택·색상 조합·소품 등 고객이 묻는 구체적인 인테리어 조언을 반드시 논리적으로 유추하여 제안하십시오.
   - 예: 특징이 '화이트·여백·차분함'이면 → "밝고 화사한 미니멀 거실에는 아이보리나 라이트 그레이 소파가 여백의 아름다움을 살려 이상적입니다"
   - 예: 특징이 '원목·베이지·따뜻함'이면 → "내추럴 스타일의 따뜻한 톤에는 카멜 브라운이나 베이지 패브릭 소파가 잘 어울립니다"
2. "정보를 찾을 수 없습니다", "관련 정보가 없습니다"라는 표현은 [참고 데이터]에 해당 스타일 자체가 전혀 없는 경우에만 사용하십시오. 스타일 특징이 조금이라도 있다면 반드시 컨설팅 답변을 생성하십시오.
3. 답변은 고객과 대화하는 인테리어 컨설턴트 말투(~입니다, ~추천드립니다, ~어울립니다, ~해보시는 건 어떨까요)로 친절하고 자연스럽게 작성하십시오.
4. 다른 스타일의 특징을 혼동하거나 섞어서 답변하지 마십시오.
5. 3~5문장 이내로 간결하게 핵심만 전달하십시오.
6. "참고 데이터에 따르면", "데이터에 기재된 바와 같이" 같은 출처 언급 서두는 절대 사용하지 마십시오. 곧바로 자연스럽게 컨설팅을 시작하십시오.
7. [이전 대화 기록]에서 이미 안내한 내용(자재명, 특징 설명 등)은 반복하지 마십시오. 고객의 최신 질문에서 새로 요구한 부분에만 집중하십시오.

[이전 대화 기록]
{chat_history}

[참고 데이터]
{context}

[고객 질문]
{question}

[컨설턴트 답변]"""


def check_is_preference_query(question: str, llm: ChatGoogleGenerativeAI) -> bool:
    """사용자 질문이 취향/디자인 추천 관련 질문인지 Gemini를 통해 판별합니다."""
    prompt = ROUTE_TEMPLATE.format(question=question)
    response = llm.invoke(prompt)
    result = response.content.strip().lower()
    return "true" in result


def _load_db1_style_context(style_keyword: str) -> str:
    """
    DB1.csv에서 주어진 스타일 키워드와 일치하는 행을 찾아
    해당 스타일의 모든 특징 데이터를 구조화된 텍스트로 반환합니다.
    ChromaDB 검색 실패 시 fallback 컨텍스트로 사용합니다.
    """
    import csv
    
    db1_path = os.path.join(current_dir, "DB1.csv")
    if not os.path.exists(db1_path):
        return ""
    
    try:
        with open(db1_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader)  # 헤더 행 읽기
            for row in reader:
                if not row or len(row) < 3:
                    continue
                style_ko = row[1].strip()   # 스타일명(한글)
                style_en = row[2].strip()   # 스타일명(영문)
                # 키워드가 스타일명에 포함되는지 확인 (대소문자 무시)
                if style_keyword in style_ko or style_keyword.lower() in style_en.lower():
                    feat1 = row[3].strip() if len(row) > 3 else ""
                    feat2 = row[4].strip() if len(row) > 4 else ""
                    feat3 = row[5].strip() if len(row) > 5 else ""
                    wallpaper = row[14].strip() if len(row) > 14 else ""
                    floor = row[16].strip() if len(row) > 16 else ""
                    target = row[29].strip() if len(row) > 29 else ""
                    
                    context_text = (
                        f"[스타일: {style_ko} ({style_en})]\n"
                        f"핵심 특징1: {feat1}\n"
                        f"핵심 특징2: {feat2}\n"
                        f"핵심 특징3: {feat3}\n"
                        f"추천 벽지: {wallpaper}\n"
                        f"추천 바닥재: {floor}\n"
                        f"주요 타겟층: {target}"
                    )
                    print(f"✅ [DB1 Direct Match] '{style_ko}' 스타일 데이터 직접 로드 성공")
                    return context_text
    except Exception as e:
        print(f"⚠️ [DB1 Load Error] {e}")
    
    return ""


def answer_preference_question(
    korean_question: str,
    chat_history: list,
    retriever: "HybridEnsembleRetriever",
    llm: ChatGoogleGenerativeAI,
) -> tuple[str, list]:
    """
    사용자의 인테리어 취향/디자인 스타일에 대한 질문을 처리합니다.
    1단계: 스타일 키워드 식별 후 DB1.csv에서 직접 스타일 특징 데이터 로드 (보강 컨텍스트)
    2단계: ChromaDB 하이브리드 검색으로 추가 관련 문서 수집
    3단계: 두 컨텍스트를 합산하여 LLM에게 풍부한 데이터 제공 후 컨설팅 답변 생성
    """
    search_query = korean_question
    if chat_history:
        print("  [1/4] 이전 대화 맥락을 기반으로 취향 질문을 재구성하는 중...")
        condense_prompt = CONDENSE_QUESTION_TEMPLATE.format(
            chat_history="\n".join(chat_history),
            question=korean_question
        )
        response = llm.invoke(condense_prompt)
        search_query = response.content.strip()
        print(f"    → 재구성된 검색 쿼리: '{search_query}'")
        
    # ── Step 1. 스타일 키워드 감지 및 DB1.csv 직접 보강 컨텍스트 생성 ──────────
    # 코어 스타일 키워드를 식별하여 ChromaDB 검색 노이즈를 줄이고,
    # DB1.csv에서 해당 스타일의 정형 데이터를 직접 읽어 컨텍스트로 보강합니다.
    style_keywords = ["미니멀", "모던", "내추럴", "우드", "클래식", "재팬디", "프렌치", "어반정글", "인더스트리얼", "빈티지", "북유럽", "Scandinavian", "Minimal", "Modern", "Natural"]
    override_query = None
    db1_boost_context = ""
    
    for kw in style_keywords:
        if kw in korean_question:
            override_query = kw
            break
        if chat_history:
            if any(kw in hist for hist in chat_history):
                override_query = kw
                break
    
    if override_query:
        print(f"🎯 [RAG Query Normalization] 스타일 키워드 '{override_query}' 감지.")
        # DB1.csv에서 해당 스타일의 정형 특징 데이터를 직접 로드
        db1_boost_context = _load_db1_style_context(override_query)
        source_docs = retriever.invoke(override_query)
    else:
        print("  [2/4] ChromaDB에서 스타일 및 취향 관련 정보 검색 중...")
        source_docs = retriever.invoke(search_query)
    
    # ── Step 2. 검색 결과 컨텍스트 조합 (DB1 직접 데이터 + ChromaDB 결과) ──────
    # DB1에서 직접 로드한 스타일 특징 데이터를 최우선 컨텍스트로 배치합니다.
    chroma_context = "\n\n---\n\n".join(
        truncate_to_complete_sentences(sanitize_text(doc.page_content), 3000) 
        for doc in source_docs
    )
    
    if db1_boost_context:
        # DB1 직접 데이터를 앞에 배치하여 LLM이 스타일 특징을 확실히 파악하도록 합니다.
        context = f"{db1_boost_context}\n\n===== 추가 참고 데이터 =====\n\n{chroma_context}"
        print(f"  ✅ [Context Boost] DB1 직접 데이터 + ChromaDB 결과 통합 완료")
    else:
        context = chroma_context
    
    print("  [4/4] Gemini AI가 인테리어 취향 맞춤 컨설팅 답변을 생성 중입니다...\n")
    print("💬 답변:")
    print("─" * 60)
    korean_answer = call_llm_stream(
        llm, PREFERENCE_TEMPLATE,
        context=context,
        chat_history="\n".join(chat_history) if chat_history else "이전 대화 기록 없음",
        question=korean_question,
    )
    print("\n" + "─" * 60)
    return korean_answer, source_docs


# ── 스트리밍 유틸리티 ───────────────────────────────────────────────────────
def call_llm_stream(llm: ChatGoogleGenerativeAI, prompt_template: str, **kwargs) -> str:
    """LLM 출력을 실시간 스트리밍 수신하여 화면에 즉시 출력하고, 최종 누적 답변을 반환합니다."""
    prompt_text = prompt_template.format(**kwargs)
    
    full_response = []
    for chunk in llm.stream(prompt_text):
        content = chunk.content
        try:
            print(content, end="", flush=True)
        except Exception:
            pass
        full_response.append(content)
    return "".join(full_response).strip()


# ── 텍스트 전처리 유틸리티 ──────────────────────────────────────────────────
def sanitize_text(text: str) -> str:
    """한글, 영문, 숫자, 표준 구두점을 제외한 모든 불필요한 제어 문자 및 특수 기호를 제거합니다."""
    # 윈도우 스타일 개행 표준화
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    
    allowed_pattern = re.compile(r"[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\s.,?!:;@#$%^&*()_+={}\[\]|\\<>\-~/`'\"★☆●■▶◀▲▼◆◇•#]")
    text = allowed_pattern.sub("", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\n+", "\n", text)
    return text.strip()


def truncate_to_complete_sentences(text: str, max_chars: int = 3000) -> str:
    """텍스트를 max_chars 글자 내외로 자르되, 문장이 마침표('.')로 종결되도록 정돈합니다."""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_period = truncated.rfind(".")
    if last_period != -1:
        return truncated[:last_period + 1].strip()
    last_newline = truncated.rfind("\n")
    if last_newline != -1:
        return truncated[:last_newline].strip()
    return truncated.strip()


# ── 커스텀 HybridEnsembleRetriever ─────────────────────────────────────────
class HybridEnsembleRetriever(BaseRetriever):
    """
    법령 + 체크리스트 + FAQ(시공지식) 세 개 컬렉션 각각에 대해
    BM25(키워드)와 Vector(의미) 하이브리드 검색을 수행하고 이를 병합하는 통합 Retriever.
    """
    law_hybrid: BaseRetriever
    checklist_hybrid: BaseRetriever
    knowledge_hybrid: BaseRetriever

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> List[Document]:
        # 세 개의 하이브리드 검색기에서 각각 RRF 융합된 관련 문서를 가져옵니다.
        law_docs       = self.law_hybrid.invoke(query)
        checklist_docs = self.checklist_hybrid.invoke(query)
        knowledge_docs = self.knowledge_hybrid.invoke(query)
        
        # 검색된 모든 문서를 하나로 합쳐서 반환합니다.
        return law_docs + checklist_docs + knowledge_docs


# ── 하이브리드 Retriever 로딩 ──────────────────────────────────────────────────────
def load_retriever(embeddings: GoogleGenerativeAIEmbeddings) -> HybridEnsembleRetriever:
    """ChromaDB 세 개 컬렉션을 로드하고, BM25(직렬화된 파일 최우선 로드)와 결합하여 하이브리드 리트리버를 빌드합니다."""
    # 1. 각 컬렉션 로드
    law_db = Chroma(
        collection_name=config.COLLECTION_LAW,
        embedding_function=embeddings,
        persist_directory=config.DB_DIR,
    )
    checklist_db = Chroma(
        collection_name=config.COLLECTION_CHECKLIST,
        embedding_function=embeddings,
        persist_directory=config.DB_DIR,
    )
    knowledge_db = Chroma(
        collection_name=config.COLLECTION_KNOWLEDGE,
        embedding_function=embeddings,
        persist_directory=config.DB_DIR,
    )
    
    # 2. BM25 리트리버 로드 (캐시된 pickle 파일이 있다면 고속 로드, 없을 시 동적 빌드 후 캐시 생성)
    # 2-1. 법령 BM25 로드
    if os.path.exists(config.BM25_LAW_PATH):
        print("  - 법령(Law) BM25 인덱스 로드 중 (캐시 파일 사용)...")
        with open(config.BM25_LAW_PATH, "rb") as f:
            law_bm25 = pickle.load(f)
    else:
        print("  - [Warning] 법령 캐시가 없어 동적 인덱스를 생성합니다...")
        law_docs = get_all_documents_from_chroma(law_db)
        law_bm25 = BM25Retriever.from_documents(law_docs, preprocess_func=kiwi_tokenize)
        with open(config.BM25_LAW_PATH, "wb") as f:
            pickle.dump(law_bm25, f)
    law_bm25.k = 2

    # 2-2. 체크리스트 BM25 로드
    if os.path.exists(config.BM25_CHECKLIST_PATH):
        print("  - 체크리스트(Checklist) BM25 인덱스 로드 중 (캐시 파일 사용)...")
        with open(config.BM25_CHECKLIST_PATH, "rb") as f:
            checklist_bm25 = pickle.load(f)
    else:
        print("  - [Warning] 체크리스트 캐시가 없어 동적 인덱스를 생성합니다...")
        checklist_docs = get_all_documents_from_chroma(checklist_db)
        checklist_bm25 = BM25Retriever.from_documents(checklist_docs, preprocess_func=kiwi_tokenize)
        with open(config.BM25_CHECKLIST_PATH, "wb") as f:
            pickle.dump(checklist_bm25, f)
    checklist_bm25.k = 2

    # 2-3. FAQ BM25 로드
    if os.path.exists(config.BM25_KNOWLEDGE_PATH):
        print("  - FAQ(Knowledge) BM25 인덱스 로드 중 (캐시 파일 사용)...")
        with open(config.BM25_KNOWLEDGE_PATH, "rb") as f:
            knowledge_bm25 = pickle.load(f)
    else:
        print("  - [Warning] FAQ 캐시가 없어 동적 인덱스를 생성합니다...")
        knowledge_docs = get_all_documents_from_chroma(knowledge_db)
        knowledge_bm25 = BM25Retriever.from_documents(knowledge_docs, preprocess_func=kiwi_tokenize)
        with open(config.BM25_KNOWLEDGE_PATH, "wb") as f:
            pickle.dump(knowledge_bm25, f)
    knowledge_bm25.k = 2

    # 3. Vector Retriever 생성
    law_vector = law_db.as_retriever(search_kwargs={"k": 2})
    checklist_vector = checklist_db.as_retriever(search_kwargs={"k": 2})
    knowledge_vector = knowledge_db.as_retriever(search_kwargs={"k": 2})
    
    # 4. 각 컬렉션별로 BM25와 Vector를 융합 (RRF 적용, 가중치 4:6)
    print("  - 컬렉션별 RRF 앙상블 리트리버 결합 중...")
    law_hybrid = LangChainEnsembleRetriever(
        retrievers=[law_bm25, law_vector],
        weights=[0.4, 0.6]
    )
    checklist_hybrid = LangChainEnsembleRetriever(
        retrievers=[checklist_bm25, checklist_vector],
        weights=[0.4, 0.6]
    )
    knowledge_hybrid = LangChainEnsembleRetriever(
        retrievers=[knowledge_bm25, knowledge_vector],
        weights=[0.4, 0.6]
    )
    
    # 5. 최종 통합 하이브리드 리트리버 반환
    return HybridEnsembleRetriever(
        law_hybrid=law_hybrid,
        checklist_hybrid=checklist_hybrid,
        knowledge_hybrid=knowledge_hybrid,
    )


# ── RAG 파이프라인 (Direct Korean RAG) ───────────────────────────────────
def answer_question(
    korean_question: str,
    chat_history: List[str],
    retriever: HybridEnsembleRetriever,
    llm: ChatGoogleGenerativeAI,
) -> tuple[str, List[Document]]:
    """
    이전 대화 기록이 존재할 경우 질문을 맥락에 맞게 재구성하고,
    ChromaDB 검색 및 컨텍스트 매핑 과정을 거쳐 실시간 RAG 답변을 생성합니다.
    """
    search_query = korean_question
    
    # ── Step 1. 이전 대화 기록이 있다면 질문 재구성 (Condense) ──────────
    if chat_history:
        print("  [1/3] 이전 대화 맥락을 기반으로 질문을 재구성하는 중...")
        history_str = "\n".join(chat_history)
        condense_prompt = CONDENSE_QUESTION_TEMPLATE.format(
            chat_history=history_str,
            question=korean_question
        )
        response = llm.invoke(condense_prompt)
        search_query = response.content.strip()
        print(f"    → 재구성된 검색 쿼리: '{search_query}'")
        
    # ── Step 2. 관련 문서 검색 ──────────────────────────────────────────
    print("  [2/3] ChromaDB에서 관련 문서 검색 중...")
    source_docs = retriever.invoke(search_query)
    
    # ── Step 3. RAG 답변 생성 (스트리밍) ──────────────────────────────────
    print(f"  [3/3] 한국어 RAG 답변 생성 중 (모델: {LLM_MODEL})...\n")
    context = "\n\n---\n\n".join(
        truncate_to_complete_sentences(sanitize_text(doc.page_content), 3000) 
        for doc in source_docs
    )
    
    # 대화 히스토리 포맷팅
    history_str = "\n".join(chat_history) if chat_history else "이전 대화 기록 없음"
    
    print("💬 답변:")
    print("─" * 60)
    korean_answer = call_llm_stream(
        llm, RAG_TEMPLATE,
        chat_history=history_str,
        context=context,
        question=korean_question,
    )
    print("\n" + "─" * 60)
    
    return korean_answer, source_docs


# ── 소스 문서 출력 포매터 ──────────────────────────────────────────────────
def print_sources(source_docs: List[Document]) -> None:
    if source_docs:
        print("📚 참고한 문서:")
        seen: set[str] = set()
        for doc in source_docs:
            meta   = doc.metadata
            label  = meta.get("article") or meta.get("process") or "N/A"
            title  = meta.get("title", "")
            source = meta.get("source", "")
            key    = f"{label}_{title}"
            if key not in seen:
                seen.add(key)
                print(f"  • [{label}] {title}  ← {source}")
    print("─" * 60)


# ── 인터랙티브 루프 ──────────────────────────────────────────────────────
def run_interactive_loop(retriever: HybridEnsembleRetriever, llm: ChatGoogleGenerativeAI) -> None:
    print("\n" + "=" * 60)
    print("  실내건축 기준 RAG 질의응답 (Google Gemini API LLM)")
    print("  (연속 대화 기억 메모리 장착 버전 - 최대 5턴 기억)")
    print("  (종료: 'exit' 또는 'quit' 입력)")
    print("=" * 60)

    # 대화 이력을 누적할 메모리 리스트 초기화
    chat_history: List[str] = []

    while True:
        try:
            user_input = input("\n❓ 질문을 입력하세요: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n\n프로그램을 종료합니다.")
            break

        if not user_input:
            print("  ⚠️  질문을 입력해주세요.")
            continue

        if user_input.lower() in ("exit", "quit", "종료"):
            print("\n프로그램을 종료합니다.")
            break

        start_time = time.time()
        try:
            # 1단계. 질문 유형 판단 (취향 질문 vs 팩트/규정 질문)
            print("🔍 질문 유형을 분석 중입니다...")
            is_preference = check_is_preference_query(user_input, llm)
            
            if is_preference:
                print("💡 취향/스타일 추천 질문으로 판별되었습니다.")
                answer, docs = answer_preference_question(user_input, retriever, llm)
                # 취향 대화도 대화 기록에 누적합니다.
                chat_history.append(f"User: {user_input}")
                chat_history.append(f"AI: {answer}")
            else:
                print("📑 시공/법률/체크리스트 질문으로 판별되었습니다.")
                # RAG 답변에 대화 내역을 전달합니다.
                answer, docs = answer_question(user_input, chat_history, retriever, llm)
                # 대화 내역 누적
                chat_history.append(f"User: {user_input}")
                chat_history.append(f"AI: {answer}")
                
            # ── 대화 기록 크기 제어 (최근 5턴 즉, 포맷 문자열 10개 항목만 유지) ──
            if len(chat_history) > 10:
                chat_history = chat_history[2:]
                print("  [알림] 대화 기록이 5턴을 초과하여 가장 오래된 대화 1턴을 메모리에서 삭제했습니다.")
                
        except Exception as exc:
            print(f"\n❌ 오류 발생: {exc}")
        elapsed = time.time() - start_time
        print(f"⏱️ 소요 시간: {elapsed:.2f}초")


# ── 메인 ─────────────────────────────────────────────────────────────────
def main() -> None:
    # Step 1. 임베딩 모델 초기화
    print("🔧 Gemini 임베딩 모델 초기화 중...")
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")

    # Step 2. 한국어 원본 컬렉션 로드
    print("📂 ChromaDB 한국어 원본 컬렉션 로드 중...")
    retriever = load_retriever(embeddings)

    # Step 3. Google Gemini API LLM 초기화
    print(f"🤖 Google Gemini LLM 초기화 중... (모델: {LLM_MODEL})")
    llm = ChatGoogleGenerativeAI(
        model=LLM_MODEL,
        temperature=0.2,
        max_retries=1, # 429 할당량 초과 및 지연 대기 루프를 최소화하여 타임아웃 방지
    )
    print("✅ 초기화 완료!\n")

    # Step 4. 인터랙티브 루프 실행
    run_interactive_loop(retriever, llm)


if __name__ == "__main__":
    main()
