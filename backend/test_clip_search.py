# -*- coding: utf-8 -*-
# test_clip_search.py
import os
os.environ["HF_ENDPOINT"] = "https://huggingface.co"
import sys
import traceback

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# backend 디렉토리를 path에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.clip_service import CLIPService
from PIL import Image

def test():
    print("[CLIP Test] CLIP Service Self-Diagnosis Start...")
    try:
        service = CLIPService()
        print(f"   Model: {service.model}")
        print(f"   Processor: {service.processor}")
        
        # 1. uploads 폴더의 이미지 탐색
        img_id = "img_00d02885"
        img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads", f"{img_id}.jpg")
        print(f"   Image Path: {img_path}")
        if not os.path.exists(img_path):
            print("[FAIL] Test image not found.")
            return
            
        # 2. 이미지 크롭 및 임베딩 추출
        with Image.open(img_path) as img:
            cropped = img.crop((50, 50, 200, 200)).convert("RGB")
            print("   Image cropped successfully.")
            emb = service.get_image_embedding(cropped)
            if emb:
                print(f"[SUCCESS] Image embedding success! (Dim: {len(emb)}, Front: {emb[:5]})")
            else:
                print("[FAIL] Image embedding returned None")
                
        # 3. 네이버 공식 API 흉내내어 다운로드 및 유사도 비교 테스트
        test_img_url = "https://search.pstatic.net/common/?src=https%3A%2F%2Fshopping-phinf.pstatic.net%2Fmain_4621884%2F46218846618.20240306141434.jpg"
        print(f"   Downloading test image: {test_img_url}")
        import requests
        from io import BytesIO
        
        resp = requests.get(test_img_url, timeout=5)
        print(f"   Status Code: {resp.status_code}")
        if resp.status_code == 200:
            pil_img = Image.open(BytesIO(resp.content)).convert("RGB")
            db_emb = service.get_image_embedding(pil_img)
            if db_emb:
                sim = service.calculate_similarity(emb, db_emb)
                print(f"[SUCCESS] Similarity: {sim:.4f}")
            else:
                print("[FAIL] Downloaded image embedding failed")
        else:
            print("[FAIL] Download failed")
            
    except Exception as e:
        print("[ERROR] Exception occurred:")
        traceback.print_exc()

if __name__ == "__main__":
    test()
