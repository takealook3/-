"""
query.py  (KO → EN → KO 파이프라인)
─────────────────────────────────────────────────────────────────────────────
데이터 흐름:
  1. 사용자 한국어 질문
      ↓  [Ollama: KO→EN 번역]
  2. 영어 질문
      ↓  [ChromaDB 영어 컬렉션 벡터 검색]
  3. 영어 컨텍스트 (법령 + 체크리스트 각 2개)
      ↓  [Ollama: 영어로 RAG 답변 생성]
  4. 영어 답변
      ↓  [Ollama: EN→KO 번역]
  5. 한국어 최종 답변 출력

장점:
  - 소형 LLM(qwen3.5:0.8b)의 영어 성능이 한국어보다 훨씬 우수
  - 영어 임베딩의 의미론적 정밀도가 높아 검색 품질 향상
  - 각 Ollama 호출이 단일 언어 작업으로 단순화됨

사용 방법:
    python -X utf8 query.py
    'exit' 또는 'quit' 입력 시 종료
"""

import os
import re
import sys
import time
from typing import List

from dotenv import load_dotenv

if sys.stdout.encoding != "utf-8":
    sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", buffering=1)

from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_ollama import ChatOllama
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda
from langchain_classic.prompts import PromptTemplate

load_dotenv()

# ── 상수 ──────────────────────────────────────────────────────────────────
DB_DIR               = "./chroma_db"
COLLECTION_CHECKLIST = "interior_checklist_en"
COLLECTION_LAW       = "interior_law_standard_en"
LLM_MODEL            = "qwen3.5:0.8b"

# ── 프롬프트 정의 ─────────────────────────────────────────────────────────

# Step 1: 한국어 → 영어 번역
KO_TO_EN_TEMPLATE = """\
Translate the following Korean text into English.
Output ONLY the English translation with no explanation or extra text.

Korean: {text}
English:"""

# Step 2: 영어로 RAG 답변 생성
RAG_TEMPLATE = """\
You are an expert assistant on Korean interior architecture regulations and construction standards.
Using ONLY the information in the [Reference Documents] below, answer the [Question] clearly and concisely.

Rules:
- Cite the article number (e.g., "Article 5") when referencing legal standards.
- Use bullet points for key items.
- If the answer is not found in the documents, say: "The provided documents do not contain information on this topic."
- Answer in English only.

[Reference Documents]
{context}

[Question]
{question}

[Answer]"""

# Step 3: 영어 → 한국어 번역
EN_TO_KO_TEMPLATE = """\
Translate the following English text into natural Korean.
Output ONLY the Korean translation with no explanation or extra text.

English: {text}
Korean:"""


# ── 유틸리티 ──────────────────────────────────────────────────────────────
def strip_think_tags(text: str) -> str:
    """qwen 계열 모델의 <think>...</think> 사고 과정 태그를 제거합니다."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def call_llm(llm: ChatOllama, prompt_template: str, **kwargs) -> str:
    """
    단일 LLM 호출 헬퍼.
    prompt_template의 {변수}를 kwargs로 채워 LLM에 전달하고 문자열 반환.
    빈 응답 시 최대 3회 재시도합니다.
    """
    prompt = PromptTemplate.from_template(prompt_template)
    chain  = prompt | llm | StrOutputParser() | RunnableLambda(strip_think_tags)
    
    for attempt in range(1, 4):  # 최대 3회 시도
        try:
            result = chain.invoke(kwargs).strip()
            if result:
                return result
        except Exception as e:
            print(f"  ⚠️  LLM 호출 오류 (시도 {attempt}/3): {e}")
        
        if attempt < 3:
            time.sleep(2)  # 빈 응답 시 잠시 대기 후 재시도
    
    return ""  # 3회 모두 실패 시 빈 문자열 반환


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
    """영어 ChromaDB 컬렉션 두 개를 EnsembleRetriever로 통합합니다."""
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
        law_retriever=law_db.as_retriever(search_kwargs={"k": 2}),
        checklist_retriever=checklist_db.as_retriever(search_kwargs={"k": 2}),
    )


# ── KO → EN → KO 3단계 파이프라인 ────────────────────────────────────────
def answer_question(
    korean_question: str,
    retriever: EnsembleRetriever,
    llm: ChatOllama,
) -> tuple[str, List[Document]]:
    """
    한국어 질문을 받아 KO→EN→KO 파이프라인으로 한국어 답변을 반환합니다.

    Returns:
        (한국어_답변, 참고한_문서_리스트)
    """
    # ── Step 1. 한국어 질문 → 영어로 번역 ─────────────────────────────
    print("  [1/3] 질문을 영어로 번역 중...")
    english_question = call_llm(llm, KO_TO_EN_TEMPLATE, text=korean_question)
    print(f"        → {english_question}")

    # ── Step 2. 영어 질문으로 ChromaDB 검색 후 영어로 답변 생성 ────────
    print("  [2/3] 영어로 RAG 답변 생성 중...")
    source_docs = retriever.invoke(english_question)
    context     = "\n\n---\n\n".join(doc.page_content for doc in source_docs)
    english_answer = call_llm(
        llm, RAG_TEMPLATE,
        context=context,
        question=english_question,
    )

    # ── Step 3. 영어 답변 → 한국어로 번역 ─────────────────────────────
    print("  [3/3] 답변을 한국어로 번역 중...")
    korean_answer = call_llm(llm, EN_TO_KO_TEMPLATE, text=english_answer)

    return korean_answer, source_docs


# ── 출력 포매터 ──────────────────────────────────────────────────────────
def print_answer(korean_answer: str, source_docs: List[Document]) -> None:
    print("\n" + "─" * 60)
    print("💬 답변:")
    print("─" * 60)
    print(korean_answer)

    if source_docs:
        print("\n📚 참고한 문서:")
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
def run_test_queries(retriever: EnsembleRetriever, llm: ChatOllama) -> None:
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
        try:
            answer, docs = answer_question(question, retriever, llm)
            print_answer(answer, docs)
        except Exception as exc:
            print(f"  ❌ 오류: {exc}")

        if i < len(test_questions):
            print("  ⏸  다음 질문까지 3초 대기...")
            time.sleep(3)

    print("\n✅ 자동 검증 완료")


# ── 인터랙티브 루프 ──────────────────────────────────────────────────────
def run_interactive_loop(retriever: EnsembleRetriever, llm: ChatOllama) -> None:
    print("\n" + "=" * 60)
    print("  실내건축 기준 RAG 질의응답 (KO→EN→KO 파이프라인)")
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

        try:
            answer, docs = answer_question(user_input, retriever, llm)
            print_answer(answer, docs)
        except Exception as exc:
            print(f"\n❌ 오류 발생: {exc}")


# ── 메인 ─────────────────────────────────────────────────────────────────
def main() -> None:
    # Step 1. 임베딩 모델 초기화 (검색에만 사용, API 호출 1회)
    print("🔧 Gemini 임베딩 모델 초기화 중...")
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")

    # Step 2. 영어 컬렉션 로드
    print("📂 ChromaDB 영어 컬렉션 로드 중...")
    retriever = load_retriever(embeddings)

    # Step 3. Ollama 로컬 LLM 초기화
    print(f"🤖 Ollama LLM 초기화 중... (모델: {LLM_MODEL})")
    llm = ChatOllama(
        model=LLM_MODEL,
        temperature=0.1,  # 번역/사실 기반 작업이므로 더 낮게 설정
        think=False,      # qwen3 계열 thinking 비활성화
    )
    print("✅ 초기화 완료!\n")

    # Step 4. 자동 검증 테스트
    run_test_queries(retriever, llm)

    # Step 5. 인터랙티브 루프
    run_interactive_loop(retriever, llm)


if __name__ == "__main__":
    main()
