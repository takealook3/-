"""
Inpainting test script
- Replace the left table in the provided image with a round wood table
- Calls the backend API (/api/image/edit) directly for pipeline validation
"""
import sys
import os

# Encoding fix for Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
os.environ['PYTHONIOENCODING'] = 'utf-8'

import requests
import json
import time
from PIL import Image, ImageDraw
import base64
from io import BytesIO

API_BASE = "http://localhost:8000"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 1. Select test image from uploads
print("=" * 60)
print("[STEP 1] Selecting test image...")
print("=" * 60)

uploads_dir = os.path.join(PROJECT_ROOT, "uploads")
candidates = []
for f in os.listdir(uploads_dir):
    fp = os.path.join(uploads_dir, f)
    if f.endswith(".jpg") and "_mask" not in f and os.path.getsize(fp) > 20000:
        candidates.append((f, os.path.getsize(fp), os.path.getmtime(fp)))

if candidates:
    # Sort by modification time (most recent first)
    candidates.sort(key=lambda x: x[2], reverse=True)
    chosen = candidates[0][0]
    image_id = chosen.replace(".jpg", "")
    print(f"Selected: {chosen} ({candidates[0][1]} bytes)")
else:
    print("ERROR: No suitable test image found")
    sys.exit(1)

# 2. Check image dimensions and calculate table mask coordinates
print(f"\n[STEP 2] Calculating mask coordinates...")

img_path = os.path.join(uploads_dir, chosen)
with Image.open(img_path) as img:
    w, h = img.size
    print(f"Image size: {w}x{h}")

# Table area in the image (roughly left 20-55%, vertical 52-72%)
table_x1 = int(w * 0.20)
table_y1 = int(h * 0.52)
table_x2 = int(w * 0.55)
table_y2 = int(h * 0.72)
print(f"Table mask: ({table_x1},{table_y1}) ~ ({table_x2},{table_y2})")

# 3. Generate Base64 mask
print(f"\n[STEP 3] Generating mask image...")

mask_img = Image.new("L", (w, h), 0)
draw = ImageDraw.Draw(mask_img)
draw.rectangle([table_x1, table_y1, table_x2, table_y2], fill=255)

buffer = BytesIO()
rgb_mask = Image.merge("RGB", (mask_img, mask_img, mask_img))
rgb_mask.save(buffer, format="PNG")
mask_base64 = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()
print(f"Mask Base64 generated (length: {len(mask_base64)} chars)")

# 4. Check ComfyUI status
print(f"\n[STEP 4] Checking ComfyUI status...")

comfyui_online = False
for attempt in range(3):
    try:
        r = requests.get("http://localhost:8188/system_stats", timeout=3)
        if r.status_code == 200:
            comfyui_online = True
            print(f"ComfyUI ONLINE (attempt {attempt+1}/3)")
            break
    except:
        pass
    print(f"ComfyUI waiting... ({attempt+1}/3, 15s delay)")
    time.sleep(15)

if not comfyui_online:
    print("WARNING: ComfyUI offline. Will use mock/local fallback.")

# 5. Call inpainting API
print(f"\n[STEP 5] Calling inpainting API...")

edit_payload = {
    "image_id": image_id,
    "session_id": f"test_session_{int(time.time())}",
    "mask": mask_base64,
    "mask_b": None,
    "mask_pixels_a": [table_x1, table_y1, table_x2, table_y2],
    "mask_pixels_b": None,
    "selected_object": None,
    "prompt": "round wooden table",
    "prompt_b": None
}

print(f"API: POST {API_BASE}/api/image/edit")
print(f"Prompt: '{edit_payload['prompt']}'")
print(f"Image ID: '{edit_payload['image_id']}'")
print(f"Mask area: ({table_x1},{table_y1}) ~ ({table_x2},{table_y2})")

try:
    response = requests.post(
        f"{API_BASE}/api/image/edit",
        json=edit_payload,
        timeout=180
    )
    
    print(f"\nResponse status: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if result.get("success"):
        edited_url = result.get("data", {}).get("edited_image_url", "")
        execution_mode = result.get("data", {}).get("workflow", {}).get("execution_mode", "unknown")
        print(f"\nSUCCESS! Inpainting completed!")
        print(f"Result URL: {edited_url}")
        print(f"Execution mode: {execution_mode}")
        
        if edited_url:
            result_filename = os.path.basename(edited_url.split("?")[0])
            result_path = os.path.join(PROJECT_ROOT, "results", result_filename)
            if os.path.exists(result_path):
                with Image.open(result_path) as res_img:
                    print(f"Result image size: {res_img.size}")
                    print(f"Result file path: {result_path}")
            else:
                print(f"Result file not found yet: {result_path}")
    else:
        print(f"\nFAILED: {result.get('message', 'Unknown error')}")
        
except requests.exceptions.Timeout:
    print("TIMEOUT: API request exceeded 180s")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()

print(f"\n{'=' * 60}")
print("Test complete!")
print("=" * 60)
