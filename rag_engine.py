# ==============================================================================
# RAG(검색 증강 생성) 사서 엔진 모듈
# 비유: 소설책을 쪼개고 분석해서 도서관 서랍에 넣은 뒤, 질문이 오면 정확한 구절을 찾아오는 사서 선생님
# ==============================================================================
import os
import json
import math
from typing import List, Dict, Any

class RAGEngine:
    def __init__(self, client, data_path="data/lucky_day.txt", cache_path="data/embeddings_cache.json"):
        """
        RAG 사서 선생님을 채용하고 초기화합니다.
        :param client: 구글 Gemini API 클라이언트 (출입증)
        :param data_path: 읽어올 소설 파일 경로
        :param cache_path: 임베딩 좌표를 기억해둘 노트(캐시) 경로
        """
        self.client = client
        self.data_path = data_path
        self.cache_path = cache_path
        self.chunks: List[str] = []
        self.embeddings: List[List[float]] = []
        self.is_ready = False

    def initialize(self):
        """
        소설책을 읽고 카드 묶음으로 나눈 뒤(청킹), 의미 좌표를 등록(임베딩)합니다.
        """
        if not self.client:
            print("[RAG 에러] Gemini 클라이언트가 연결되지 않아 사서가 일을 할 수 없습니다.")
            return

        # 1. 소설 파일 텍스트 읽기
        if not os.path.exists(self.data_path):
            print(f"[RAG 에러] 소설 파일({self.data_path})을 찾을 수 없습니다.")
            return

        with open(self.data_path, "r", encoding="utf-8") as f:
            full_text = f.read()

        # 2. 텍스트 분할 (Chunking: 500글자 단위, 50자 중복)
        # 비유: 긴 소설을 가위로 잘라 한 페이지씩 카드에 적는 것
        self.chunks = self._chunk_text(full_text, chunk_size=500, overlap=50)
        print(f"[RAG 안내] 소설을 총 {len(self.chunks)}개의 카드 조각으로 분할했습니다.")

        # 3. 임베딩 좌표 확인 및 추출
        # 비유: 이미 분석해둔 비밀 노트(json)가 있으면 거기서 읽어오고, 없으면 구글 AI에게 분석을 맡김
        if os.path.exists(self.cache_path):
            try:
                with open(self.cache_path, "r", encoding="utf-8") as f:
                    cache_data = json.load(f)
                    if len(cache_data.get("chunks", [])) == len(self.chunks):
                        self.embeddings = cache_data["embeddings"]
                        self.is_ready = True
                        print("[RAG 완료] 기존에 분석해 둔 도서관 서랍장(캐시)에서 좌표를 즉시 불러왔습니다!")
                        return
            except Exception as e:
                print(f"[RAG 경고] 캐시 읽기 실패, 새로 분석합니다: {e}")

        # [수정] 구글 공식 안정형 임베딩 모델(embedding-001)로 변경하여 404 오류를 방지합니다.
        print("[RAG 시작] 구글 인공지능(embedding-001)을 이용해 문단별 의미 좌표를 추출합니다...")
        self.embeddings = []
        for i, chunk in enumerate(self.chunks):
            try:
                response = self.client.models.embed_content(
                    model="embedding-001",
                    contents=chunk
                )
                # 추출된 숫자 벡터 좌표 저장
                self.embeddings.append(response.embedding.values)
            except Exception as e:
                print(f"[RAG 오류] {i}번 카드 임베딩 실패: {e}")
                self.embeddings.append([0.0]*768) # 실패 시 임시 좌표

        # 분석한 결과를 파일(캐시)로 영구 저장
        os.makedirs("data", exist_ok=True)
        with open(self.cache_path, "w", encoding="utf-8") as f:
            json.dump({"chunks": self.chunks, "embeddings": self.embeddings}, f, ensure_ascii=False)

        self.is_ready = True
        print("[RAG 완료] 모든 소설 조각의 임베딩 분석 및 도서관 저장이 완료되었습니다!")

    def _chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """
        글자를 지정된 크기로 자르되, 문맥이 끊기지 않게 약간씩 겹쳐서 자릅니다.
        """
        chunks = []
        start = 0
        text_len = len(text)
        while start < text_len:
            end = min(start + chunk_size, text_len)
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            start += (chunk_size - overlap)
        return chunks

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        두 숫자 좌표(벡터)가 얼마나 유사한지 각도(코사인 유사도)를 계산합니다. (1.0에 가까울수록 아주 비슷함)
        """
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot_product / (norm1 * norm2)

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        사용자의 질문과 가장 유사한 소설 카드 Top K개를 찾아옵니다.
        """
        if not self.is_ready or not self.client:
            return []

        # 1. 질문도 구글 AI를 통해 숫자 좌표(벡터)로 번역
        try:
            # [수정] 사용자 질문도 책 본문과 동일한 안정형 임베딩 모델(embedding-001)로 좌표 변환
            q_res = self.client.models.embed_content(
                model="embedding-001",
                contents=query
            )
            q_vec = q_res.embedding.values
        except Exception as e:
            print(f"[RAG 에러] 질문 임베딩 실패: {e}")
            return []

        # 2. 도서관의 모든 카드와 유사도 점수 계산
        scores = []
        for i, emp_vec in enumerate(self.embeddings):
            sim = self._cosine_similarity(q_vec, emp_vec)
            scores.append((sim, self.chunks[i]))

        # 3. 점수가 가장 높은 순으로 정렬해서 Top K개 뽑기
        scores.sort(key=lambda x: x[0], reverse=True)
        
        results = []
        for score, text in scores[:top_k]:
            results.append({
                "similarity": round(score * 100, 1), # 백분율 점수로 변환 (예: 85.4%)
                "text": text
            })
        return results

    def generate_answer(self, query: str) -> Dict[str, Any]:
        """
        검색해 온 소설 구절을 바탕으로 Gemini 대학생에게 정답 작성을 시킵니다.
        """
        # 1. 관련 소설 카드 검색
        retrieved_docs = self.search(query, top_k=3)
        if not retrieved_docs:
            return {
                "status": "error",
                "answer": "관련 소설 구절을 찾지 못했거나 사서 시스템이 준비되지 않았습니다.",
                "contexts": []
            }

        # 2. 참고 자료 텍스트 합치기
        context_text = "\n\n".join([f"[참고 구절 {i+1} (유사도 {doc['similarity']}%)]:\n{doc['text']}" for i, doc in enumerate(retrieved_docs)])

        # 3. Gemini에게 오픈북 시험 프롬프트 전달
        prompt = f"""
너는 한국문학 전문 AI 도슨트이자 따뜻한 선생님이야.
아래 제공된 [소설 원문 참고 자료]를 꼼꼼히 읽고, 사용자의 질문에 답변해줘.

[소설 원문 참고 자료]:
{context_text}

[사용자의 질문]: {query}

[답변 작성 규칙]:
1. 반드시 제공된 [소설 원문 참고 자료] 안의 내용에 입각해서 답변할 것. (자료에 없는 내용은 지어내지 말 것)
2. 비전공자나 초보자도 쉽게 이해할 수 있도록 친절하고 재미있게 설명해 줄 것.
3. 보기 좋게 마크다운 문법(굵은 글씨, 줄바꿈 등)을 활용해 줄 것.
"""
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            return {
                "status": "success",
                "answer": response.text.strip(),
                "contexts": retrieved_docs
            }
        except Exception as e:
            return {
                "status": "error",
                "answer": f"Gemini 답변 생성 중 오류 발생: {str(e)}",
                "contexts": retrieved_docs
            }
