# ==============================================================================
# RAG API 작동 검증 테스트 스크립트 (test_rag_api.py)
# ==============================================================================
import urllib.request
import json

# 1. API 서버 주소 설정 (RAG 질문 엔드포인트)
url = "http://127.0.0.1:8000/api/rag-query"

# 2. 서버에 전송할 질문 데이터 구성
data = {
    "query": "소설 주인공이 누구야?"
}

# 3. 딕셔너리를 JSON 바이트 문자열로 변환 (한글 지원을 위해 utf-8 인코딩)
json_data = json.dumps(data).encode("utf-8")

# 4. HTTP 요청 헤더 및 요청 객체 생성
req = urllib.request.Request(url, data=json_data)
req.add_header("Content-Type", "application/json; charset=utf-8")

print(f"📡 RAG 서버({url})에 질문('{data['query']}')을 전송하는 중입니다...")

try:
    # 5. 서버에 요청 전송 및 응답 수신
    with urllib.request.urlopen(req) as response:
        # 6. 응답 데이터 디코딩 및 JSON 파싱
        result_text = response.read().decode("utf-8")
        result = json.loads(result_text)
        
        print("\n🎉 [테스트 성공] RAG 인공지능이 응답한 결과입니다:\n")
        print(json.dumps(result, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"\n❌ [테스트 실패] 오류 발생: {e}")
