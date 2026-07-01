# =====================================================================
# test_mvp.py: ZipPT 백엔드 8대 핵심 API 자동 검증 스크립트입니다.
# =====================================================================

import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from fastapi.testclient import TestClient
from main import app
import os

client = TestClient(app)

def run_tests():
    print("=====================================================================")
    print("🚀 [ZipPT 종합 API (기존 4종 + 신규 4종) 자동 검증 시식회 시작]")
    print("=====================================================================\n")

    session_id = "session_test_comprehensive"

    # 1. GET /health
    print("1️⃣ [1번 창구] GET /health 검증 중...")
    res1 = client.get("/health")
    assert res1.status_code == 200 and res1.json()["success"] == True

    # 2. POST /api/images/upload
    print("2️⃣ [2번 창구] POST /api/images/upload 검증 중...")
    test_file_path = "temp_test.jpg"
    with open(test_file_path, "wb") as f:
        f.write(b"dummy image content")
    with open(test_file_path, "rb") as f:
        res2 = client.post(
            "/api/images/upload",
            files={"image": ("test_wall.jpg", f, "image/jpeg")},
            data={"session_id": session_id}
        )
    if os.path.exists(test_file_path):
        os.remove(test_file_path)
    assert res2.status_code == 200 and res2.json()["success"] == True

    # 3. POST /api/graffiti/remove
    print("3️⃣ [3번 창구] POST /api/graffiti/remove 검증 중...")
    res3 = client.post(
        "/api/graffiti/remove",
        json={"image_id": "img_001", "session_id": session_id, "mode": "auto", "prompt": "Remove graffiti"}
    )
    assert res3.status_code == 200 and res3.json()["success"] == True

    # 4. GET /api/images/{image_id}
    print("4️⃣ [4번 창구] GET /api/images/img_001 검증 중...")
    res4 = client.get("/api/images/img_001")
    assert res4.status_code == 200 and res4.json()["success"] == True

    # 5. [신규 1] POST /api/image/generate
    print("5️⃣ [신규 1] POST /api/image/generate 검증 중...")
    res5 = client.post(
        "/api/image/generate",
        json={"session_id": session_id, "prompt": "Graffiti art on wall", "style": "realistic", "keep_structure": False}
    )
    print(f"   - 응답 알맹이: {res5.json()['data']}\n")
    assert res5.status_code == 200 and res5.json()["success"] == True
    assert "task_id" in res5.json()["data"]

    # 5-1. [신규 1-2] POST /api/products/search
    print("5️⃣-1 [신규 1-2] POST /api/products/search 검증 중...")
    res_prod = client.post(
        "/api/products/search",
        json={"prompt": "북유럽풍 침대", "selected_object": "bed"}
    )
    prod_data = res_prod.json()["data"]
    print(f"   - 추천된 유사 가구 수: {len(prod_data['products'])}건")
    for prod in prod_data["products"]:
        print(f"     * {prod['product_name']} ({prod['price']}) - 유사도 {int(prod['similarity']*100)}%")
    print()
    assert res_prod.status_code == 200 and res_prod.json()["success"] == True
    assert len(prod_data["products"]) > 0

    # 6. [신규 2] POST /api/chat (에러 처리 및 정상 처리)
    print("6️⃣ [신규 2] POST /api/chat (질문 빈값 에러 및 정상 답변) 검증 중...")
    res6_err = client.post("/api/chat", json={"session_id": session_id, "question": ""})
    assert res6_err.status_code == 400 and res6_err.json()["error_code"] == "INVALID_INPUT"

    res6_ok = client.post("/api/chat", json={"session_id": session_id, "question": "벽면 낙서 어떻게 지우나요?"})
    print(f"   - 답변: {res6_ok.json()['data']['answer'][:30]}...")
    print(f"   - 참고 출처: {res6_ok.json()['data']['references']}\n")
    assert res6_ok.status_code == 200 and len(res6_ok.json()["data"]["references"]) > 0

    # 7. [신규 3] POST /api/image/edit
    print("7️⃣ [신규 3] POST /api/image/edit 검증 중...")
    res7 = client.post(
        "/api/image/edit",
        json={"image_id": "img_001", "session_id": session_id, "mask": [10, 20, 100, 200], "selected_object": "graffiti", "prompt": "Clean wall"}
    )
    print(f"   - 응답 알맹이: {res7.json()['data']}\n")
    assert res7.status_code == 200 and res7.json()["success"] == True

    # 8. [신규 4] GET /api/sessions/{session_id} (메모리 종합 내역 조회)
    print(f"8️⃣ [신규 4] GET /api/sessions/{session_id} (누적 방명록 조회) 검증 중...")
    res8 = client.get(f"/api/sessions/{session_id}")
    data8 = res8.json()["data"]
    print(f"   - 누적된 생성 내역 수: {len(data8['generations'])}건")
    print(f"   - 누적된 편집 내역 수: {len(data8['edits'])}건")
    print(f"   - 누적된 대화 내역 수: {len(data8['chats'])}건\n")
    assert res8.status_code == 200 and len(data8['generations']) >= 1 and len(data8['edits']) >= 2 and len(data8['chats']) >= 1

    print("=====================================================================")
    print("🎉 [최종 판정] 기존 4종 + 신규 우선순위 4종 및 누적 장부까지 100점 만점 통과!")
    print("=====================================================================")

if __name__ == "__main__":
    run_tests()
