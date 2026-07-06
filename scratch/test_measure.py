import sys
import os

# 프로젝트 루트 경로 추가
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../backend"))

from backend.main import internal_generate_interior_image

if __name__ == "__main__":
    print("=== 성능 측정 테스트 시작 (Gemini 번역 + ComfyUI) ===")
    res = internal_generate_interior_image(
        image_id="img_065dfafb",
        session_id="session_measure_test",
        style="modern",
        prompt="따뜻하고 아늑한 우드 스타일 방 꾸며줘"
    )
    print("\n=== [2차 연속 호출 - 캐시 검증] ===")
    res2 = internal_generate_interior_image(
        image_id="img_065dfafb",
        session_id="session_measure_test",
        style="modern",
        prompt="따뜻하고 아늑한 우드 스타일 방 꾸며줘"
    )
    print("=== 성능 측정 테스트 완료 ===")
    print("결과:", res2)
