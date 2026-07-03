import os
import sys
import json
import time
import shutil
import requests
from PIL import Image, ImageDraw

# 한글 출력 설정
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 경로 설정
PROJECT_ROOT = r"c:\Users\USER\Desktop\project"
COMFYUI_PATH = r"C:\Users\USER\Desktop\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"
COMFYUI_INPUT_DIR = os.path.join(COMFYUI_PATH, "ComfyUI", "input")
if not os.path.exists(COMFYUI_INPUT_DIR):
    COMFYUI_INPUT_DIR = os.path.join(COMFYUI_PATH, "input")

COMFYUI_OUTPUT_DIR = os.path.join(COMFYUI_PATH, "ComfyUI", "output")
if not os.path.exists(COMFYUI_OUTPUT_DIR):
    COMFYUI_OUTPUT_DIR = os.path.join(COMFYUI_PATH, "output")

# 입력 이미지 정의
orig_filename = "img_8d776941.jpg"
orig_path = os.path.join(PROJECT_ROOT, "uploads", orig_filename)

if not os.path.exists(orig_path):
    print(f"❌ 원본 이미지를 찾을 수 없습니다: {orig_path}")
    sys.exit(1)

# 이미지 크기 가져오기
with Image.open(orig_path) as img:
    w, h = img.size
    print(f"📷 원본 이미지 크기: {w}x{h}")

# 마스크 이미지 생성 및 저장 (L 모드 1채널 흑백 PNG)
# 1. 왼쪽 의자 영역 마스크 (테이블 및 의자 포괄)
mask1_filename = "relay_test_mask_chair.png"
mask1_path = os.path.join(PROJECT_ROOT, "uploads", mask1_filename)
mask1_img = Image.new("L", (w, h), 0)
draw1 = ImageDraw.Draw(mask1_img)
# 의자 및 테이블 영역 BBox: x1=20, y1=220, x2=180, y2=460 (기존 maskA 17830560616 참고)
draw1.rectangle([20, 220, 180, 460], fill=255)
mask1_img.save(mask1_path, "PNG")
print(f"🎨 마스크 1 (의자) 저장 완료: {mask1_path}")

# 2. 오른쪽 소파 영역 마스크
mask2_filename = "relay_test_mask_sofa.png"
mask2_path = os.path.join(PROJECT_ROOT, "uploads", mask2_filename)
mask2_img = Image.new("L", (w, h), 0)
draw2 = ImageDraw.Draw(mask2_img)
# 소파 영역 BBox: x1=120, y1=230, x2=395, y2=400
draw2.rectangle([120, 230, 395, 400], fill=255)
mask2_img.save(mask2_path, "PNG")
print(f"🎨 마스크 2 (소파) 저장 완료: {mask2_path}")

# ComfyUI input 디렉토리로 파일 복사
print("📁 ComfyUI input 디렉토리로 파일 복사 중...")
shutil.copy(orig_path, os.path.join(COMFYUI_INPUT_DIR, orig_filename))
shutil.copy(mask1_path, os.path.join(COMFYUI_INPUT_DIR, mask1_filename))
shutil.copy(mask2_path, os.path.join(COMFYUI_INPUT_DIR, mask2_filename))
print("✅ 파일 복사 완료")

# inpainting.json 워크플로우 로드 및 파라미터 바인딩
workflow_json_path = os.path.join(PROJECT_ROOT, "inpainting.json")
with open(workflow_json_path, "r", encoding="utf-8") as f:
    workflow = json.load(f)

# 노드 주입
# 1. 원본 이미지 로드 설정 (Node 5)
workflow["5"]["inputs"]["image"] = orig_filename
# 2. 마스크 1 로드 설정 (Node 17)
workflow["17"]["inputs"]["image"] = mask1_filename
# 3. 긍정 프롬프트 1 주입 (Node 6)
workflow["6"]["inputs"]["text"] = "(scandinavian designer wooden chair:1.35), light warm oak wood texture, highly detailed, photorealistic, 8k"
# 4. KSampler 1 설정 (Node 3)
workflow["3"]["inputs"]["seed"] = 42
workflow["3"]["inputs"]["steps"] = 25
workflow["3"]["inputs"]["cfg"] = 8.0
workflow["3"]["inputs"]["denoise"] = 0.81

# 5. 마스크 2 로드 설정 (Node 18)
workflow["18"]["inputs"]["image"] = mask2_filename
# 6. 긍정 프롬프트 2 주입 (Node 11)
workflow["11"]["inputs"]["text"] = "(modern luxury cozy bed with white linens and pillows:1.35), photorealistic, highly detailed, 8k"
# 7. KSampler 2 설정 (Node 15)
workflow["15"]["inputs"]["seed"] = 42 + 13
workflow["15"]["inputs"]["steps"] = 25
workflow["15"]["inputs"]["cfg"] = 8.0
workflow["15"]["inputs"]["denoise"] = 0.81

# 8. 아웃풋 설정 (SaveImage: Node 9)
result_prefix = f"ComfyUI_relay_test_{int(time.time())}"
workflow["9"]["inputs"]["filename_prefix"] = result_prefix
workflow["9"]["inputs"]["images"] = ["16", 0] # 2단계 최종 디코드 결과물 지정

print("🚀 ComfyUI API로 프롬프트 전송 중...")
try:
    res = requests.post("http://127.0.0.1:8188/prompt", json={"prompt": workflow}, timeout=10)
    res_data = res.json()
    prompt_id = res_data.get("prompt_id")
    if not prompt_id:
        print(f"❌ 프롬프트 등록 실패: {res_data}")
        sys.exit(1)
    
    print(f"📡 작업 제출 성공! Prompt ID: {prompt_id}")
    
    # 완료 대기 (최대 180초)
    print("⏳ AI 이미지 렌더링 대기 중 (최대 3분)...")
    history_url = f"http://127.0.0.1:8188/history/{prompt_id}"
    
    for i in range(600):
        time.sleep(0.5)
        try:
            h_res = requests.get(history_url, timeout=5)
            h_data = h_res.json()
            if prompt_id in h_data:
                print("🟢 렌더링 완료!")
                outputs = h_data[prompt_id].get("outputs", {})
                for node_id, out_data in outputs.items():
                    if "images" in out_data:
                        filename = out_data["images"][0].get("filename")
                        comfy_out_path = os.path.join(COMFYUI_OUTPUT_DIR, filename)
                        dest_path = os.path.join(PROJECT_ROOT, "results", filename)
                        
                        if os.path.exists(comfy_out_path):
                            # 결과 리사이즈 및 저장 (원본 크기 w, h 로 맞춤)
                            with Image.open(comfy_out_path) as res_img:
                                resized_img = res_img.resize((w, h), Image.Resampling.LANCZOS)
                                resized_img.save(dest_path, "JPEG", quality=95)
                            print(f"🎉 최종 합성 결과물이 저장되었습니다: {dest_path}")
                            sys.exit(0)
        except Exception as poll_err:
            pass
            
    print("❌ 대기 시간 초과로 이미지 생성 결과 확인 실패.")
    sys.exit(1)
    
except Exception as e:
    print(f"❌ ComfyUI 통신 에러: {e}")
    sys.exit(1)
