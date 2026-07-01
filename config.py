# config.py
# ─────────────────────────────────────────────────────────────────────────────
# 프로젝트 전반에서 사용되는 공통 설정 상수 값들을 중앙 관리하는 모듈입니다.
# ─────────────────────────────────────────────────────────────────────────────

# ChromaDB 공통 데이터베이스가 저장될 로컬 디렉토리 경로
DB_DIR = "./chroma_db"

# 데이터베이스 내부 컬렉션 이름 정의
COLLECTION_LAW       = "interior_law_standard"  # 실내건축 기준 고시 법령
COLLECTION_CHECKLIST = "interior_checklist"     # 인테리어 공정별 체크리스트
COLLECTION_KNOWLEDGE = "interior_knowledge"     # 시공 순서 및 FAQ 지식 데이터

# 컬렉션별 BM25 인덱스 캐시 직렬화 파일(.pkl) 저장 경로
BM25_LAW_PATH       = "./bm25_law.pkl"
BM25_CHECKLIST_PATH = "./bm25_checklist.pkl"
BM25_KNOWLEDGE_PATH = "./bm25_knowledge.pkl"
