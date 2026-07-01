import os
import pickle
from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_community.vectorstores import Chroma 
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.retrievers import BM25Retriever

# 공통 설정 및 유틸 임포트
import config
from utils import kiwi_tokenize

# 1. .env 파일로부터 GOOGLE_API_KEY 자동 로드
load_dotenv()

# 2. 전처리된 청크 1~5 전체 데이터 생성 (Document 객체화)
chunks = [
    Document(
        page_content="""# [공사 전] 최종 준비단계 체크리스트
인테리어 공사를 시작하기 전, 법적 문제나 이웃 간 분쟁을 방지하기 위한 최종 필수 준비 단계입니다.

1. 공사 완료 날짜 확인: 가구 배정 및 입주 일정과 조율
2. 동의서 작성 및 행정 절차
   - 주민 동의서 받기 (아파트/공동주택 필수 관리사무소 기준 충족)
   - 법적 허가 사항 확인 (확장 공사 등 행위허가 신고 필요 여부)
   - 인접 세대(상하좌우 변동이 큰 세대) 서면 동의 및 사전 양해 구하기
   - 공사 안내문 엘리베이터 및 게시판 부착
3. 가전과 가구 수령 일정 조율: 공정 마감 후 진입할 수 있도록 배치
4. 공사 현장 특이 사항 파악 (누수 흔적, 노후도 사전 체크)
5. 공사 순서 파악과 전체 스케줄표 작성 및 확정""",
        metadata={
            "source": "https://www.lxzin.com/styling/style-guide/detail/7398",
            "title": "하자 없이 완벽하게, 인테리어 공정별 체크리스트",
            "category": "공사 전",
            "process": "최종 준비단계"
        }
    ),
    Document(
        page_content="""# [공사 중] 기초 및 구조 공정 (철거/설비/창호/단열)
공사가 본격적으로 진행되는 과정에서 뼈대를 잡고 꼼꼼히 체크해야 할 사항입니다.

1. 철거 및 설비
   - 구조벽/비내력벽 철거 규정 준수 여부 확인
   - 배관 이설 및 방수 공사 상태 점검
2. 창호 및 단열 (매우 중요)
   - 창호는 단열 성능과 직결되므로, 준공 15년 이상 된 아파트는 교체를 강력히 고려합니다.
   - 창호 시공 전에는 예정일 기준 최소 7~10일 전에 정밀 실측을 완료해야 합니다.
   - 시공 후에는 실리콘 충진 마감과 본드 같은 잔여물 정리 상태를 꼼꼼히 확인해야 합니다.
   - 단열 성능 보완이 필요한 확장 공간 등은 목공 공정 단계에서 우레탄 폼이나 PF 보드처럼 단열 성능이 우수한 자재를 사용하는지 수시로 확인하는 것이 중요합니다.""",
        metadata={
            "source": "https://www.lxzin.com/styling/style-guide/detail/7398",
            "title": "하자 없이 완벽하게, 인테리어 공정별 체크리스트",
            "category": "공사 중",
            "process": "철거, 설비, 창호, 단열"
        }
    ),
    Document(
        page_content="""# [공사 중] 수장 및 마감 공정 (목공/전기/타일/도배/바닥/가구)
인테리어의 형태가 잡히고 표면이 마감되는 단계의 체크리스트입니다.

1. 목공 및 전기 1차 공정: 가벽 설치, 천장 보수, 조명 배선 위치 선점
2. 마감 공정 (타일, 도장 및 필름, 바닥, 도배)
   - 타일: 들뜸 현상 방지를 위한 평탄도 및 줄눈(메우기) 확인
   - 도장 및 필름: 기포나 들뜸, 모서리 마감 처리 상태 확인
   - 바닥 및 도배: 이음새 부분이 울거나 벌어지지 않는지 확인
3. 마무리 공정 (가구 및 전기 2차 공정)
   - 맞춤 가구 수평 배정 및 서랍 개폐 부드러움 점검
   - 콘센트, 스위시, 등기구 최종 연결 및 작동 테스트""",
        metadata={
            "source": "https://www.lxzin.com/styling/style-guide/detail/7398",
            "title": "하자 없이 완벽하게, 인테리어 공정별 체크리스트",
            "category": "공사 중",
            "process": "목공, 전기, 마감, 마무리"
        }
    ),
    Document(
        page_content="""# [공사 후] 공정별 필수 확인 사항 - ① 기초공사
공사가 완료된 후, 눈에 잘 보이지 않는 설비나 구조물 위주로 하자가 없는지 파악하는 검수 단계입니다. 문제가 발견되면 즉시 업체에 보수를 요청해야 합니다.

1. 철거 검수: 계획된 영역이 도면에 맞게 깔끔하게 철거되었으며 폐기물이 완전히 반출되었는지 확인
2. 설비 검수: 배수구 물 빠짐이 원활한지(배수 테스트), 수전 배관 연결부위 미세 누수가 없는지 체크
3. 창호 검수: 흔들림 없이 부드럽게 열리고 닫히는지, 문을 닫았을 때 틈새 바람(기밀성)이 없는지, 실리콘 마감이 균일한지 검사
4. 목공 검수: 석고보드 타공 부위나 가벽의 수평·수직 상태가 바르게 고정되었는지 확인""",
        metadata={
            "source": "https://www.lxzin.com/styling/style-guide/detail/7398",
            "title": "하자 없이 완벽하게, 인테리어 공정별 체크리스트",
            "category": "공사 후",
            "process": "기초공사 검수 (철거, 설비, 창호, 목공)"
        }
    ),
    Document(
        page_content="""# [공사 후] 공정별 필수 확인 사항 - ② 수장 및 마감재 공사
시각적 퀄리티와 일상 사용 편의성에 직접적인 영향을 주는 마감 상태 검수 리스트입니다.

1. 타일 및 욕실 검수
   - 타일 구배(경사도)가 잘 맞아 욕실 바닥 물이 고이지 않고 배수구로 잘 흘러가는지 확인
   - 도기류(양변기, 세면대) 흔들림 및 실리콘/백시멘트 갈라짐 여부 체크
2. 마감재(필름, 도장, 도배, 바닥) 검수
   - 필름/도장: 꺾이는 모서리 부분이 뜨거나 우는 곳이 없는지 확인
   - 도배: 벽지 이음매 벌어짐 점검 (단, 시공 직후 젖어서 우는 현상은 며칠 후 펴지므로 감안할 것)
   - 바닥: 걸어 다닐 때 찌걱거리는 소음이 나거나 찍힌 배부름 부위가 없는지 검수
3. 전기 검수: 모든 스위치가 제 짝의 전등을 켜는지, 차단기가 내려가지 않고 정상 작동하는지 확인""",
        metadata={
            "source": "https://www.lxzin.com/styling/style-guide/detail/7398",
            "title": "하자 없이 완벽하게, 인테리어 공정별 체크리스트",
            "category": "공사 후",
            "process": "수장/마감재 검수 (타일, 욕실, 필름, 도배, 바닥, 전기)"
        }
    )
]

# 3. Google Gemini 임베딩 모델 선언
embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")

# 4. Chroma DB 경로 및 컬렉션 로드 (중복 방지 초기화 처리)
print("Chroma DB 데이터 적재 및 초기화 중...")
temp_store = Chroma(
    collection_name=config.COLLECTION_CHECKLIST,
    embedding_function=embeddings,
    persist_directory=config.DB_DIR
)
db_get = temp_store.get()
if db_get and db_get['ids']:
    print(f"-> 기존 데이터 {len(db_get['ids'])}개를 감지하여 삭제(초기화)를 진행합니다.")
    temp_store.delete(ids=db_get['ids'])

# 신규 데이터 적재
vector_store = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory=config.DB_DIR,
    collection_name=config.COLLECTION_CHECKLIST
)
print("Chroma DB 영구 적재 완료!\n")

# 5. BM25 색인 파일 사전 빌드 및 직렬화 저장
print("BM25 리트리버 캐시 인덱스 직렬화 빌드 중...")
bm25_retriever = BM25Retriever.from_documents(chunks, preprocess_func=kiwi_tokenize)
with open(config.BM25_CHECKLIST_PATH, "wb") as f:
    pickle.dump(bm25_retriever, f)
print(f"-> BM25 파일 저장 완료: {config.BM25_CHECKLIST_PATH}\n")

# 6. [검증 단계] Vector Search 테스트 수행
print("=" * 40)
print("데이터 적재 확인을 위한 검색 테스트를 시작합니다.")
print("=" * 40)

# 테스트 질문 1: 공사 전 서류 작업 관련
query_1 = "공사하기 전에 이웃들한테 받아야 하는 서류가 있어?"
print(f"\n[테스트 질문 1]: {query_1}")
results_1 = vector_store.similarity_search(query_1, k=1)
print(f"-> 검색된 공정 항목: {results_1[0].metadata['process']}")

# 테스트 질문 2: 욕실 마감 관련
query_2 = "화장실 인테리어 끝나고 물 안 빠지면 어떻게 확인해?"
print(f"\n[테스트 질문 2]: {query_2}")
results_2 = vector_store.similarity_search(query_2, k=1)
print(f"-> 검색된 공정 항목: {results_2[0].metadata['process']}")
print(f"-> 내용 발췌:\n{results_2[0].page_content[:200]}...")