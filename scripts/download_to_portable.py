import os
import urllib.request
import sys
import time
from dotenv import load_dotenv

# .env 파일 활성화
# (프로젝트 루트 디렉토리 기준 상위/동일 레벨 탐색)
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path=dotenv_path)
else:
    load_dotenv()


def download_file(url, dest_path, max_retries=5):
    if os.path.exists(dest_path):
        if os.path.getsize(dest_path) > 1024 * 1024:
            print(f"[Exist] {dest_path} ({os.path.getsize(dest_path)/(1024*1024):.1f} MB)")
            return
        else:
            print(f"[Warning] Resuming download for: {dest_path}")
            os.remove(dest_path)
            
    temp_dest = dest_path + ".tmp"
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    for attempt in range(1, max_retries + 1):
        print(f"\n[Download Attempt {attempt}/{max_retries}] {url} -> {dest_path}")
        try:
            if os.path.exists(temp_dest):
                try:
                    os.remove(temp_dest)
                except:
                    pass
                
            def report(block_num, block_size, total_size):
                read_so_far = block_num * block_size
                if total_size > 0:
                    percent = read_so_far * 1e2 / total_size
                    sys.stdout.write(f"\rDownloading... {percent:.1f}% ({read_so_far/(1024*1024):.1f} MB / {total_size/(1024*1024):.1f} MB)")
                    sys.stdout.flush()
                else:
                    sys.stdout.write(f"\rDownloading... {read_so_far/(1024*1024):.1f} MB")
                    sys.stdout.flush()
                    
            opener = urllib.request.build_opener()
            opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
            urllib.request.install_opener(opener)
            
            urllib.request.urlretrieve(url, temp_dest, reporthook=report)
            
            if os.path.exists(dest_path):
                os.remove(dest_path)
            os.rename(temp_dest, dest_path)
            print(f"\n[Download Success] {dest_path}")
            return
            
        except Exception as e:
            print(f"\n[Error] Attempt {attempt} failed: {e}")
            if os.path.exists(temp_dest):
                try:
                    os.remove(temp_dest)
                except:
                    pass
            if attempt < max_retries:
                time.sleep(3)
            else:
                raise e

# 실제 포터블 경로 (환경변수 또는 기본 Fallback 경로 조합)
COMFYUI_PATH = os.getenv(
    "COMFYUI_PATH",
    r"C:\Users\USER\Desktop\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"
)
PORTABLE_COMFY_ROOT = os.path.join(COMFYUI_PATH, "ComfyUI")

models_to_download = [
    {
        "url": "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors",
        "dest": os.path.join(PORTABLE_COMFY_ROOT, "models/checkpoints/v1-5-pruned-emaonly.safetensors")
    },
    {
        "url": "https://huggingface.co/lllyasviel/control_v11p_sd15_inpaint/resolve/main/diffusion_pytorch_model.safetensors",
        "dest": os.path.join(PORTABLE_COMFY_ROOT, "models/controlnet/control_v11p_sd15_inpaint.safetensors")
    },
    {
        "url": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth",
        "dest": os.path.join(PORTABLE_COMFY_ROOT, "models/sams/sam_vit_h_4b8939.pth")
    },
    {
        "url": "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8x-oiv7.pt",
        "dest": os.path.join(PORTABLE_COMFY_ROOT, "models/ultralytics/bbox/yolov8x-oiv7.pt")
    }
]

if __name__ == "__main__":
    print("=== Downloading AI Models to Portable ComfyUI Folder ===")
    for m in models_to_download:
        download_file(m["url"], m["dest"])
    print("\nAll models loaded successfully.")
