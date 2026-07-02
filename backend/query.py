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
# AI가 사용자에게 대답할 때 사용할 안내 규칙(템플릿)을 정의합니다.
RAG_TEMPLATE = """\
당신은 대한민국 실내건축 기준 고시 및 인테리어 공정 표준 체크리스트 전문가입니다.
답변은 오직 제공된 [참고 문서]에 명시된 사실(Fact)만을 근거로 작성되어야 합니다. 당신의 최우선 임무는 [참고 문서]의 내용을 알기 쉽게 다듬는 것입니다.

답변 규칙:
1. 제공된 [참고 문서]에 명시되지 않은 가상의 정보나 당신의 자체적인 전문 지식, 외부 상식은 절대로 답변에 포함하거나 유추하여 지어내지 마십시오.
2. 당신의 역할은 [참고 문서]에 있는 사실적 내용을 친절하고 자연스러운 한국어 대화체(예: ~입니다, ~해보세요, ~하시는 것이 좋습니다)로 다듬어 말투를 순화하고 가공하는 것으로 제한됩니다.
3. 답변은 질문에 대한 핵심 요약 위주로 가급적 3~5문장 이내로 간결하게 작성하십시오.
4. 만약 질문한 내용이 [참고 문서]에 전혀 언급되어 있지 않거나 관련 정보를 찾을 수 없는 경우, 임의로 말을 만들어내지 말고 "제공된 문서에서 관련 정보를 찾을 수 없습니다"라고 정중하게 답변하십시오.
5. 답변 시 "제공된 문서에 따르면", "참고 데이터에 명시된 바와 같이", "문서에 의하면" 등 참고 문서의 출처를 노출하거나 언급하는 서두 문구를 절대 사용하지 말고, 질문에 대한 결론과 내용 위주로 즉시 자연스럽게 답변하십시오.
6. [이전 대화 기록]에서 이미 설명했거나 답변한 중복 정보(예: 추천했던 특정 브랜드/자재명 등)는 다시 반복하지 마십시오. 최신 질문에 응답하기 위해 필요한 새로운 핵심 사실 정보만 군더더기 없이 대답하십시오.

[이전 대화 기록]
{chat_history}

[참고 문서]
{context}

[최신 질문]
{question}

[답변]"""

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


# ── 취향 및 디자인 스타일 라우터 & 프롬프트 정의 ───────────────────────────
# 사용자의 질문이 주관적인 디자인 취향/스타일 추천인지, 객관적인 법률/체크리스트인지 판별하기 위한 프롬프트입니다.
ROUTE_TEMPLATE = """\
사용자의 질문이 다음 카테고리에 해당하는지 판단하십시오:
- 개인의 인테리어 취향, 선호하는 분위기나 스타일 추천 (예: 모던, 북유럽, 빈티지, 내추럴 등)
- 공간 스타일링, 가구 배치, 색상 조합, 조명 디자인 및 소품 추천에 대한 디자인 조언
- 트렌디한 디자인 아이디어나 주관적인 미적 가이드 추천 및 팁 제공 요청

위 카테고리에 명확히 해당하면 오직 한 단어로 'true'라고만 대답하고, 
법률, 기술 기준, 안전 고시, 하자 판정, 구체적인 시공 체크리스트/공정 순서 등 객관적인 팩트나 기술 규정에 관한 질문이면 'false'라고만 대답하십시오.
어떠한 설명이나 다른 단어도 덧붙이지 마십시오.

[사용자 질문]
{question}

[답변]"""

# 취향 및 디자인 스타일 추천을 위한 전용 컨설팅 프롬프트입니다.
PREFERENCE_TEMPLATE = """\
당신은 대한민국 대표 인테리어 공간 디자인 및 홈 스타일링 전문가입니다.
답변은 오직 제공된 [참고 데이터]에 명시된 스타일 정보만을 근거로 작성되어야 합니다.

[답변 규칙]
1. [참고 데이터]에 명시되지 않은 스타일의 특징을 임의로 상상하거나 당신의 자체 지식으로 살을 붙여 새로운 정보를 만들지 마십시오.
2. 당신의 역할은 [참고 데이터]에 기재된 특정 인테리어 스타일의 객관적인 특징들을 친절하고 부드러운 한국어 대화체(~입니다, ~해보세요)로 말투만 자연스럽게 다듬고 가공하는 것입니다.
3. 다른 인테리어 스타일의 특징들과 정보를 서로 섞거나 혼동하여 답변을 작성하지 마십시오.
4. 만약 질문하신 스타일에 대해 [참고 데이터] 내에 구체적인 정보가 전혀 제공되지 않은 경우, 거짓이나 상상으로 채우지 말고 "관련 스타일 취향 정보를 찾을 수 없습니다"라고 정중하게 답변하십시오.
5. 너무 장황하지 않게 3~5문장 이내로 정리하십시오.
6. 답변 시 "제공된 문서에 따르면", "참고 데이터에 기재된 바와 같이" 등 참고 출처를 유추할 수 있는 서두 문구를 직접적으로 절대 사용하지 말고, 추천 스타일의 본론과 묘사 내용 위주로 즉시 자연스럽게 답변하십시오.
7. [이전 대화 기록]에 이미 등장했거나 사용한 중복 자재명, 특징 설명 등은 절대 앵무새처럼 되풀이 설명하지 마십시오. 최신 질문에서 추가로 묻거나 요구한 정보에만 정밀 집중해 군더더기 없이 간결하게 필요한 사실만 대답하십시오.

[이전 대화 기록]
{chat_history}

[참고 데이터]
{context}

[질문]
{question}

[답변]"""


def check_is_preference_query(question: str, llm: ChatGoogleGenerativeAI) -> bool:
    """사용자 질문이 취향/디자인 추천 관련 질문인지 Gemini를 통해 판별합니다."""
    prompt = ROUTE_TEMPLATE.format(question=question)
    response = llm.invoke(prompt)
    result = response.content.strip().lower()
    return "true" in result


def answer_preference_question(
    korean_question: str,
    chat_history: list,
    retriever: "HybridEnsembleRetriever",
    llm: ChatGoogleGenerativeAI,
) -> tuple[str, list]:
    """
    사용자의 인테리어 취향/디자인 스타일에 대한 질문을 처리합니다.
    이전 대화 맥락(chat_history)을 고려하여 검색 쿼리를 결합/재구성한 뒤 관련 스타일 정보를 검색합니다.
    """
    search_query = korean_question
    if chat_history:
        print("  [1/3] 이전 대화 맥락을 기반으로 취향 질문을 재구성하는 중...")
        condense_prompt = CONDENSE_QUESTION_TEMPLATE.format(
            chat_history="\n".join(chat_history),
            question=korean_question
        )
        response = llm.invoke(condense_prompt)
        search_query = response.content.strip()
        print(f"    → 재구성된 검색 쿼리: '{search_query}'")
        
    print("  [2/3] ChromaDB에서 스타일 및 취향 관련 정보 검색 중...")
    source_docs = retriever.invoke(search_query)
    
    context = "\n\n---\n\n".join(
        truncate_to_complete_sentences(sanitize_text(doc.page_content), 3000) 
        for doc in source_docs
    )
    
    print("  [3/3] Gemini AI가 인테리어 취향 맞춤 컨설팅 답변을 생성 중입니다...\n")
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
