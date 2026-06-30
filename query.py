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
RAG_TEMPLATE = """\
당신은 대한민국 실내건축 기준 고시 및 인테리어 공정 표준 체크리스트 전문가입니다.
반드시 아래 제공된 [참고 문서]의 내용만을 기반으로 하여 사용자의 [질문]에 대해 정확하고 신뢰할 수 있게 한국어로 답변하십시오.

답변 규칙:
1. 제공된 [참고 문서]에 포함된 팩트(Fact)만을 근거로 작성하십시오. 주관적인 추정이나 문서에 없는 내용은 절대 지어내지 마십시오.
2. 법률(고시) 내용을 인용할 때는 반드시 해당 조항 번호(예: "제5조")와 조항 제목을 명시하십시오.
3. 인테리어 공정 체크리스트 내용을 인용할 때는 해당 공정 단계 및 공정 항목명을 함께 언급하십시오.
4. 가독성을 위해 핵심 사항은 글머리 기호(•) 또는 번호 매기기를 사용하여 구조화하십시오.
5. 만약 질문에 답변하기에 참고 문서의 정보가 부족하거나 찾을 수 없다면, 억지로 답변하지 말고 정확하게 다음과 같이 답변하십시오: "제공된 문서에서 관련 정보를 찾을 수 없습니다."

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
    법령 + 체크리스트 두 영어 컬렉션을 병합하는 커스텀 Retriever.
    법령 검색 결과를 먼저, 체크리스트 결과를 뒤에 배치합니다.
    """
    law_retriever: BaseRetriever
    checklist_retriever: BaseRetriever

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> List[Document]:
        law_docs       = self.law_retriever.invoke(query)
        checklist_docs = self.checklist_retriever.invoke(query)
        return law_docs + checklist_docs


# ── 벡터스토어 로딩 ──────────────────────────────────────────────────────
def load_retriever(embeddings: GoogleGenerativeAIEmbeddings) -> EnsembleRetriever:
    """ChromaDB 컬렉션 두 개를 EnsembleRetriever로 통합합니다."""
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
    return EnsembleRetriever(
        law_retriever=law_db.as_retriever(search_kwargs={"k": 3}),
        checklist_retriever=checklist_db.as_retriever(search_kwargs={"k": 3}),
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


# ── 자동 검증 테스트 ─────────────────────────────────────────────────────
def run_test_queries(retriever: EnsembleRetriever, llm: ChatGoogleGenerativeAI) -> None:
    test_questions = [
        "실내에 유리 칸막이 설치할 때 어떤 안전 기준을 지켜야 해?",
        "화장실 타일 바닥 미끄럼 방지 기준이 뭐야?",
        "공사 끝나고 욕실 검수할 때 뭘 봐야 해?",
    ]

    print("\n" + "=" * 60)
    print("  [자동 검증] 테스트 질문 3개 실행")
    print("=" * 60)

    for i, question in enumerate(test_questions, 1):
        print(f"\n🧪 [테스트 {i}] {question}")
        start_time = time.time()
        try:
            answer, docs = answer_question(question, retriever, llm)
            print_sources(docs)
        except Exception as exc:
            print(f"  ❌ 오류: {exc}")
        elapsed = time.time() - start_time
        print(f"⏱️ 소요 시간: {elapsed:.2f}초")

        if i < len(test_questions):
            print("  ⏸  다음 질문까지 1초 대기...")
            time.sleep(1)

    print("\n✅ 자동 검증 완료")


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
            print_sources(docs)
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

    # Step 4. 자동 검증 테스트
    run_test_queries(retriever, llm)

    # Step 5. 인터랙티브 루프
    run_interactive_loop(retriever, llm)


if __name__ == "__main__":
    main()
