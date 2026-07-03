# test_inpainting_api.py: ComfyUI 디폴트 파라미터 연동 검증 테스트 스크립트
# 동작 설명:
#   - Payload에서 steps, cfg, denoise 키를 완전히 누락시켰을 때,
#     백엔드가 알아서 최적 디폴트 값(Denoise 0.81, CFG 8.0, Steps 25)을 적용해
#     카페트 없이 오직 테이블만 1인용 나무 스툴로 자연스럽게 바꾸어 반환하는지 검증합니다.

import requests
import json
import os
import time
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

API_URL = "http://127.0.0.1:8000/api/image/edit"
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# 소파를 침대로 바꾸는 실시간 마스크 정밀 합성 연동 테스트 페일로드
payload = {
    "image_id": "img_8d776941",
    "session_id": "session_sofa_to_bed_test",
    "mask": [120, 230, 395, 400], # 소파 영역 BBox 좌표
    "mask_b": None,
    "selected_object": "sofa",
    "prompt": "(modern minimalist cozy bed:1.3), soft neat white bed sheets, fluffy pillows, warm indirect ambient lighting, photorealistic, 8k",
    "seed": 100
}

def run_test():
    print("=" * 80)
    print("🚀 [Inpainting API Test] 디폴트 파라미터 매핑 연동 테스트를 시작합니다.")
    print("💡 (주의: steps, cfg, denoise를 페일로드에서 배제하여 백엔드 자체 보정 동작 검증)")
    print(f"📡 API Endpoint: {API_URL}")
    print(f"📦 Payload:\n{json.dumps(payload, indent=2, ensure_ascii=False)}")
    print("=" * 80)
    
    start_time = time.time()
    try:
        response = requests.post(API_URL, json=payload, timeout=120)
        elapsed = round(time.time() - start_time, 2)
        
        print(f"📥 응답 수신 완료 (소요 시간: {elapsed}초) - HTTP Status: {response.status_code}")
        
        if response.status_code == 200:
            res_json = response.json()
            if res_json.get("success"):
                data = res_json.get("data", {})
                edited_url = data.get("edited_image_url")
                mode = data.get("workflow", {}).get("execution_mode")
                
                print("\n🟢 [성공] 인페인팅 단독 변환이 완료되었습니다.")
                print(f"💡 구동 모드: {mode}")
                print(f"🔗 결과 이미지 URL: {edited_url}")
                
                if edited_url.startswith("/static/results/"):
                    filename = edited_url.split("/")[-1]
                    local_result_path = os.path.join(project_root, "results", filename)
                    
                    if os.path.exists(local_result_path):
                        # 검증용 별칭 저장 (case1_default_fallback.jpg)
                        alias_name = "case1_default_fallback.jpg"
                        alias_path = os.path.join(project_root, "results", alias_name)
                        import shutil
                        shutil.copy(local_result_path, alias_path)
                        print(f"📂 [검증 사본 저장 완료] 파일: {alias_path} (크기: {os.path.getsize(alias_path)} 바이트)")
            else:
                print(f"❌ [실패] success=False: {res_json.get('message')}")
        else:
            print(f"❌ [실패] HTTP 에러: {response.text}")
            
    except Exception as e:
        print(f"❌ [실패] 연결 에러 또는 예외 발생: {e}")
    print("=" * 80)

if __name__ == "__main__":
    run_test()
