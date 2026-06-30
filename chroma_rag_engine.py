# ==============================================================================
# 랭체인(LangChain) & 크로마DB(ChromaDB) 기반 한국어 소설 RAG 엔진
# ==============================================================================
# 비유하자면, 이 엔진은 도서관 사서 선생님(LangChain)이 A4 10장짜리 한국어 소설을
# 한입 크기 카드 조각으로 예쁘게 잘라서 전자 금고(ChromaDB)에 보관해 두고,
# 관람객이 질문하면 가장 관련 있는 카드 조각을 꺼내어 구글 AI 비서(Gemini)에게 읽어주고
# 친절하게 답변을 만들어내는 핵심 두뇌 시스템입니다!

import os
import sys
from typing import List, Dict, Any

# 1. 환경변수(.env 파일) 로딩
from dotenv import load_dotenv

# 2. 랭체인 텍스트 분할기 (소설을 잘게 자르는 가위)
from langchain_text_splitters import RecursiveCharacterTextSplitter

# 3. 랭체인 문서 객체
from langchain_core.documents import Document

# 4. 구글 공식 임베딩 (글자를 숫자 좌표로 바꾸는 관상가)
from langchain_google_genai import GoogleGenerativeAIEmbeddings

# 5. 크로마 벡터 데이터베이스 (숫자 좌표 카드를 보관하는 전자 금고)
from langchain_chroma import Chroma

# 6. 구글 최신 생성 AI 라이브러리 (답변을 말해주는 비서)
from google import genai
from google.genai import types


class ChromaRAGEngine:
    """
    LangChain과 ChromaDB를 연동하여 소설 기반 오픈북 질의응답을 수행하는 RAG 엔진 클래스입니다.
    """
    def __init__(
        self,
        data_file: str = "data/korean_novel.txt",
        db_directory: str = "data/chroma_db"
    ):
        # 비유: 소설 원본 책 위치와 전자 금고 서랍장 위치를 기억합니다.
        self.data_file = data_file
        self.db_directory = db_directory
        self.vector_store = None
        self.gemini_client = None
        self.embeddings = None

    def initialize(self) -> bool:
        """
        RAG 엔진을 초기화합니다. API 키를 로드하고, DB가 없으면 소설을 청킹하여 DB를 구축합니다.
        """
        load_dotenv()
        
        # .env 파일에서 GEMINI_API_KEY 가져오기
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            print("\n❌ [오류] .env 파일에서 'GEMINI_API_KEY'를 찾을 수 없습니다!")
            print("👉 [해결 방법]: .env 파일에 GEMINI_API_KEY=본인키 를 입력해주세요.")
            return False

        # LangChain 구글 임베딩 모듈이 인식할 수 있도록 환경변수를 동기화합니다.
        os.environ["GOOGLE_API_KEY"] = api_key

        try:
            # 구글 생성 AI 클라이언트 및 임베딩 객체 초기화
            self.gemini_client = genai.Client(api_key=api_key)
            self.embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")
            print("💡 [안내] 구글 Gemini 임베딩(text-embedding-004) 및 LLM 연결 완료!")

            # 이미 구축된 크로마DB 금고 폴더가 존재하는지 확인합니다.
            if os.path.exists(self.db_directory) and os.listdir(self.db_directory):
                print(f"📦 [안내] 기존에 저장된 전자 금고({self.db_directory})에서 데이터를 불러옵니다...")
                self.vector_store = Chroma(
                    persist_directory=self.db_directory,
                    embedding_function=self.embeddings
                )
            else:
                print(f"🔨 [안내] 금고가 비어있습니다. 소설 파일({self.data_file})을 분석하여 DB를 새로 구축합니다...")
                self._build_database()

            return True

        except Exception as e:
            print(f"\n❌ [초기화 오류 발생]: {e}")
            print("👉 [해결 방법]: 인터넷 연결 상태나 API 키 유효성을 확인해주세요.")
            return False

    def _build_database(self):
        """
        소설 텍스트를 읽어와 랭체인으로 청킹하고 크로마DB에 영구 저장합니다.
        """
        if not os.path.exists(self.data_file):
            raise FileNotFoundError(f"소설 원본 파일({self.data_file})이 존재하지 않습니다.")

        # 1. 파일 읽기 (utf-8)
        with open(self.data_file, "r", encoding="utf-8") as f:
            raw_text = f.read()

        print(f"📖 [안내] 총 {len(raw_text):,} 글자의 한국어 소설 데이터를 읽었습니다.")

        # 2. 랭체인 텍스트 분할기 설정 (비유: 600글자씩 자르되, 문맥이 끊기지 않게 50글자는 겹치게 자름)
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=600,
            chunk_overlap=50,
            separators=["\n\n", "\n", ".", "!", "?", " ", ""],
            length_function=len
        )

        # 3. 텍스트 분할 실행
        chunks = text_splitter.split_text(raw_text)
        print(f"✂️ [안내] 소설이 총 {len(chunks)} 개의 카드 조각(청크)으로 분할되었습니다!")

        # 4. 문서 객체로 변환 (메타데이터 추가)
        documents = [
            Document(page_content=chunk, metadata={"chunk_id": i, "source": "korean_novel.txt"})
            for i, chunk in enumerate(chunks)
        ]

        # 5. 크로마DB에 임베딩 벡터로 변환하여 영구 저장(persist)
        print("⏳ [안내] 구글 임베딩을 통해 카드 조각들을 숫자 좌표로 변환하고 금고에 저장 중입니다... (잠시만 기다려주세요)")
        self.vector_store = Chroma.from_documents(
            documents=documents,
            embedding=self.embeddings,
            persist_directory=self.db_directory
        )
        print(f"🎉 [성공] 크로마DB 금고({self.db_directory}) 구축 완료!")

    @property
    def is_ready(self) -> bool:
        """엔진 준비 완료 여부를 반환합니다."""
        return self.vector_store is not None and self.gemini_client is not None

    def generate_answer(self, query: str, top_k: int = 3) -> Dict[str, Any]:
        """
        사용자의 질문을 받아 가장 유사한 소설 조각을 검색한 뒤 답변을 생성합니다. (기존 API 호환 규격)
        """
        if not self.is_ready:
            return {
                "status": "error",
                "answer": "RAG 엔진이 초기화되지 않았습니다.",
                "contexts": []
            }

        try:
            # 1. 크로마DB에서 질문과 가장 의미가 가까운 카드 조각 상위 top_k개 검색 (유사도 검색)
            docs_with_scores = self.vector_store.similarity_search_with_score(query, k=top_k)

            context_texts = []
            retrieved_docs = []

            for doc, score in docs_with_scores:
                # L2 거리 기반 점수를 이해하기 쉽게 백분율 형태의 유사도 점수로 변환
                similarity_percent = round(max(0.0, min(100.0, (1.0 - score / 2.0) * 100)), 1)
                snippet = doc.page_content.strip()
                context_texts.append(f"[참고 구절 (유사도 {similarity_percent}%)]:\n{snippet}")
                retrieved_docs.append({
                    "similarity": similarity_percent,
                    "text": snippet
                })

            # 2. AI에게 넘겨줄 프롬프트(대본) 구성
            joined_context = "\n\n---\n\n".join(context_texts)
            prompt = f"""
다음은 한국어 단편소설(운수 좋은 날, 동백꽃, 메밀꽃 필 무렵 등)에서 발췌한 본문 조각들입니다.
아래 발췌된 본문 내용을 바탕으로 사용자의 질문에 정확하고 친절하게 답변해주세요.

[발췌된 본문 내용]:
{joined_context}

[사용자 질문]: {query}

[답변 작성 가이드]:
1. 오직 위에 발췌된 본문 내용에 근거해서 답변하세요. 본문에 없는 내용은 추측하지 마세요.
2. 대학교 1학년 비전공자도 흥미롭게 읽을 수 있도록 쉽고 명확한 말투로 설명해주세요.
3. 답변 끝에는 어떤 소설의 어떤 상황이었는지 간략히 요약 덧붙여주세요.
"""

            # 3. Gemini LLM 생성 요청
            response = self.gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )

            return {
                "status": "success",
                "answer": response.text.strip(),
                "contexts": retrieved_docs
            }

        except Exception as e:
            print(f"❌ [질의응답 오류]: {e}")
            return {
                "status": "error",
                "answer": f"답변 생성 중 오류가 발생했습니다: {e}",
                "contexts": []
            }


# 독립 실행 테스트용 코드
if __name__ == "__main__":
    engine = ChromaRAGEngine()
    if engine.initialize():
        test_q = "김 첨지가 오늘 하루 벌어들인 돈과 아내가 먹고 싶어 하던 음식은 무엇인가요?"
        print("\n" + "="*65)
        print(f"❓ [테스트 질문]: {test_q}")
        print("="*65)
        res = engine.generate_answer(test_q)
        print(f"\n💡 [AI 사서 답변]:\n{res['answer']}")
        print("\n📚 [참고한 소설 조각들]:")
        for idx, src in enumerate(res['contexts'], 1):
            print(f"  {idx}. (유사도 {src['similarity']}%) {src['text'][:80]}...")
        print("="*65)
