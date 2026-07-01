# config.py
# ─────────────────────────────────────────────────────────────────────────────
# 프로젝트 전반에서 사용되는 공통 설정 상수 값들을 중앙 관리하는 모듈입니다.
# ─────────────────────────────────────────────────────────────────────────────
import os

# config.py가 존재하는 물리 디렉터리 절대경로 획득
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ChromaDB 공통 데이터베이스가 저장될 절대경로
DB_DIR = os.path.join(BASE_DIR, "chroma_db")

# 데이터베이스 내부 컬렉션 이름 정의
COLLECTION_LAW       = "interior_law_standard"  # 실내건축 기준 고시 법령
COLLECTION_CHECKLIST = "interior_checklist"     # 인테리어 공정별 체크리스트
COLLECTION_KNOWLEDGE = "interior_knowledge"     # 시공 순서 및 FAQ 지식 데이터

# 컬렉션별 BM25 인덱스 캐시 직렬화 파일(.pkl) 저장 절대경로
BM25_LAW_PATH       = os.path.join(BASE_DIR, "bm25_law.pkl")
BM25_CHECKLIST_PATH = os.path.join(BASE_DIR, "bm25_checklist.pkl")
BM25_KNOWLEDGE_PATH = os.path.join(BASE_DIR, "bm25_knowledge.pkl")
