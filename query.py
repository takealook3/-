"""
query.py  (Google Gemini-1.5-flash RAG 엔진 최적화 + 실시간 스트리밍 버전)
─────────────────────────────────────────────────────────────────────────────
데이터 흐름:
  1. 사용자 한국어 질문
      ↓  [models/gemini-embedding-001 임베딩 활용]
  2. ChromaDB 한국어 원본 컬렉션에서 관련 법률/체크리스트 문서 검색 (k=3)
      ↓  [ChatGoogleGenerativeAI (gemini-1.5-flash) 호출]
  3. Gemini 1.5 Flash가 참고 문서를 분석하여 정확하고 신뢰할 수 있는 한국어 RAG 답변 생성
      ↓  [실시간 토큰 스트리밍]
  4. 한국어 최종 답변 화면에 즉시 스트리밍 출력
"""

import os
import re
import sys
import time
from typing import List

from dotenv import load_dotenv

# stdout 인코딩 재설정 (한글 출력 깨짐 방지)
try:
    if sys.stdout.encoding != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")
except AttributeError:
    pass

# .env 절대 경로 기반 안전 로드
current_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(current_dir, ".env")
load_dotenv(dotenv_path)

from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.prompts import PromptTemplate

# ── 상수 ──────────────────────────────────────────────────────────────────
DB_DIR               = "./chroma_db"
COLLECTION_CHECKLIST = "interior_checklist"
COLLECTION_LAW       = "interior_law_standard"
LLM_MODEL            = "gemini-2.5-flash"

# ── RAG 프롬프트 정의 ──────────────────────────────────────────────────────
# AI가 사용자에게 대답할 때 사용할 안내 규칙(템플릿)을 정의합니다.
RAG_TEMPLATE = """\
당신은 대한민국 실내건축 기준 고시 및 인테리어 공정 표준 체크리스트 전문가입니다.
제공된 [참고 문서]의 내용을 기반으로 하여 사용자의 [질문]에 대해 마치 친절한 전문가가 상담을 해주듯 자연스럽고 따뜻한 한국어 대화체로 답변하십시오.

답변 규칙:
1. 문서를 그대로 받아적지 말고, 실제 사람과 대화하는 것처럼 부드럽고 자연스러운 어조(예: ~입니다, ~해 보세요, ~하시는 것이 좋습니다)로 답하세요.
2. 답변의 길이는 너무 길지 않게, 질문에 대한 핵심 요약 위주로 명확하게 작성하세요 (가급적 3~5문장 이내로 정리).
3. 제공된 [참고 문서]에 포함된 팩트(Fact)만을 근거로 작성하되, 법률 조항이나 체크리스트 항목을 대답에 자연스럽게 녹여서 설명하세요.
4. 만약 질문에 답변하기에 참고 문서의 정보가 부족하거나 찾을 수 없다면, 지어내지 말고 부드럽게 다음과 같이 답변하십시오: "제공된 문서에서는 관련 정보를 찾기가 어렵네요."

[참고 문서]
{context}

[질문]
{question}

[답변]"""



# ── 스트리밍 유틸리티 ───────────────────────────────────────────────────────
def call_llm_stream(llm: ChatGoogleGenerativeAI, prompt_template: str, **kwargs) -> str:
    """
    LLM 출력을 실시간 스트리밍 수신하여 화면에 즉시 출력하고, 최종 누적 답변을 반환합니다.
    """
    prompt_text = prompt_template.format(**kwargs)
    
    full_response = []
    # ChatOllama의 stream 메소드 직접 호출
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
    """
    한글, 영문, 숫자, 표준 구두점을 제외한 모든 눈에 보이지 않는 제어문자 및 특수 유니코드 기호(OOV 토큰)를 제거합니다.
    """
    # 윈도우 스타일 개행 표준화
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    
    # 허용하는 문자 패턴 정의 (한글, 영문, 숫자, 공백, 표준 키보드 특수문자 및 기호)
    allowed_pattern = re.compile(r"[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\s.,?!:;@#$%^&*()_+={}\[\]|\\<>\-~/`'\"★☆●■▶◀▲▼◆◇•#]")
    
    # 허용 패턴 이외의 모든 문자 제거
    text = allowed_pattern.sub("", text)
    
    # \xa0 (Non-breaking space) 등 이상한 유니코드 공백을 일반 공백으로 변환
    text = re.sub(r"\s+", " ", text)
    
    # 연속 줄바꿈 방지
    text = re.sub(r"\n+", "\n", text)
    
    return text.strip()


def truncate_to_complete_sentences(text: str, max_chars: int = 3000) -> str:
    """
    텍스트를 max_chars 글자 내외로 자르되, 
    마지막 문장이 마침표('.')로 끝나 완결된 문장 구조를 갖추도록 잘라냅니다.
    """
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


# ── 커스텀 EnsembleRetriever ─────────────────────────────────────────────
class EnsembleRetriever(BaseRetriever):
    """
    법령 + 체크리스트 두 컬렉션을 병합하는 커스텀 Retriever.
    임베딩 API 호출을 딱 1회만 수행하도록 최적화되어 속도를 높입니다.
    """
    law_db: Chroma
    checklist_db: Chroma
    embeddings: GoogleGenerativeAIEmbeddings
    k: int = 2  # 참고할 문서 개수 (각 DB에서 2개씩 총 4개 가져옴)
    
    # [최적화] 중복 질문에 대해 API 호출을 방지하기 위한 메모리 캐시 수첩을 만듭니다.
    _query_cache: dict = {}

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> List[Document]:
        # 1. 이전에 질문한 적이 있는지 수첩(캐시)에서 먼저 확인합니다.
        if query in self._query_cache:
            print("  [캐시 사용] 이미 번역된 질문입니다. 구글 API 호출을 건너뜁니다.")
            query_vector = self._query_cache[query]
        else:
            # 2. 처음 묻는 질문이라면 구글 임베딩 API를 호출하고 수첩에 기록합니다.
            query_vector = self.embeddings.embed_query(query)
            self._query_cache[query] = query_vector
        
        # 3. 변환된 벡터를 사용해 추가 API 호출 없이 로컬 DB에서 유사한 내용을 검색합니다.
        law_docs       = self.law_db.similarity_search_by_vector(query_vector, k=self.k)
        checklist_docs = self.checklist_db.similarity_search_by_vector(query_vector, k=self.k)
        
        # 두 DB에서 검색된 문서를 하나로 합쳐서 반환합니다.
        return law_docs + checklist_docs


# ── 벡터스토어 로딩 ──────────────────────────────────────────────────────
def load_retriever(embeddings: GoogleGenerativeAIEmbeddings) -> EnsembleRetriever:
    """ChromaDB 컬렉션 두 개를 불러와 최적화된 EnsembleRetriever로 통합합니다."""
    law_db = Chroma(
        collection_name=COLLECTION_LAW,
        embedding_function=embeddings,
        persist_directory=DB_DIR,
    )
    checklist_db = Chroma(
        collection_name=COLLECTION_CHECKLIST,
        embedding_function=embeddings,
        persist_directory=DB_DIR,
    )
    # DB 인스턴스와 임베딩 모델을 직접 주입하여 임베딩 재사용이 가능하게 합니다.
    return EnsembleRetriever(
        law_db=law_db,
        checklist_db=checklist_db,
        embeddings=embeddings,
    )


# ── RAG 파이프라인 (Direct Korean RAG) ───────────────────────────────────
def answer_question(
    korean_question: str,
    retriever: EnsembleRetriever,
    llm: ChatGoogleGenerativeAI,
) -> tuple[str, List[Document]]:
    """
    한국어 질문으로 ChromaDB에서 관련 한국어 문서를 직접 검색하고,
    검색 결과 컨텍스트를 제공하여 Gemini가 한국어로 답변하도록 처리합니다.
    """
    # ── Step 1. 한국어 질문으로 직접 ChromaDB 검색 ─────────────────────
    print("  [1/2] ChromaDB에서 관련 문서 검색 중...")
    source_docs = retriever.invoke(korean_question)
    
    # ── Step 2. 검색된 한국어 문서를 참고하여 한국어로 RAG 답변 생성 (스트리밍) ──
    print(f"  [2/2] 한국어 RAG 답변 생성 중 (모델: {LLM_MODEL})...\n")
    context = "\n\n---\n\n".join(truncate_to_complete_sentences(sanitize_text(doc.page_content), 3000) for doc in source_docs)
    
    print("💬 답변:")
    print("─" * 60)
    korean_answer = call_llm_stream(
        llm, RAG_TEMPLATE,
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
def run_interactive_loop(retriever: EnsembleRetriever, llm: ChatGoogleGenerativeAI) -> None:
    print("\n" + "=" * 60)
    print("  실내건축 기준 RAG 질의응답 (Google Gemini API LLM)")
    print("  (종료: 'exit' 또는 'quit' 입력)")
    print("=" * 60)

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
            answer, docs = answer_question(user_input, retriever, llm)
            # 대화형 답변만 깔끔하게 보여주기 위해 참고 문서 출처 출력은 비활성화합니다.
            # print_sources(docs)
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
    )
    print("✅ 초기화 완료!\n")

    # Step 4. 곧바로 사용자의 질문을 입력받는 인터랙티브 루프 실행
    run_interactive_loop(retriever, llm)



if __name__ == "__main__":
    main()
