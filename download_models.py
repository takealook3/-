import os
import urllib.request
import sys
import time

def download_file(url, dest_path, max_retries=5):
    if os.path.exists(dest_path):
        # 파일이 존재할 경우 크기가 정상인지 확인 (1MB 이상인 경우 이미 완료로 간주)
        if os.path.getsize(dest_path) > 1024 * 1024:
            print(f"[이미 존재함] {dest_path} ({os.path.getsize(dest_path)/(1024*1024):.1f} MB)")
            return
        else:
            print(f"[경고] 비정상적인 크기의 파일 발견으로 재다운로드 진행: {dest_path}")
            os.remove(dest_path)
            
    temp_dest = dest_path + ".tmp"
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    for attempt in range(1, max_retries + 1):
        print(f"\n[다운로드 시도 {attempt}/{max_retries}] {url} -> {dest_path}")
        try:
            # 매 시도마다 깨끗하게 새로 시작하기 위해 이전 임시 파일 삭제
            if os.path.exists(temp_dest):
                try:
                    os.remove(temp_dest)
                except:
                    pass
                
            def report(block_num, block_size, total_size):
                read_so_far = block_num * block_size
                if total_size > 0:
                    percent = read_so_far * 1e2 / total_size
                    sys.stdout.write(f"\r다운로드 중... {percent:.1f}% ({read_so_far/(1024*1024):.1f} MB / {total_size/(1024*1024):.1f} MB)")
                    sys.stdout.flush()
                else:
                    sys.stdout.write(f"\r다운로드 중... {read_so_far/(1024*1024):.1f} MB")
                    sys.stdout.flush()
                    
            # User-Agent 설정으로 일부 차단 서버 우회 및 30초 타임아웃 대응을 위해 opener 설정
            opener = urllib.request.build_opener()
            opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
            urllib.request.install_opener(opener)
            
            # urllib.request.urlretrieve 호출
            urllib.request.urlretrieve(url, temp_dest, reporthook=report)
            
            # 완료되면 임시 파일을 원래 이름으로 바꿈
            if os.path.exists(dest_path):
                os.remove(dest_path)
            os.rename(temp_dest, dest_path)
            print(f"\n[다운로드 완료] {dest_path}")
            return  # 다운로드 성공 시 종료
            
        except Exception as e:
            print(f"\n[에러 발생] 시도 {attempt} 실패: {e}")
            if os.path.exists(temp_dest):
                try:
                    os.remove(temp_dest)
                except:
                    pass
            if attempt < max_retries:
                print("5초 후 재시도합니다...")
                time.sleep(5)
            else:
                print("\n최대 재시도 횟수를 초과했습니다.")
                raise e

# 다운로드 정보 정의
models_to_download = [
    {
        "url": "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors",
        "dest": "ComfyUI/models/checkpoints/v1-5-pruned-emaonly.safetensors"
    },
    {
        "url": "https://huggingface.co/lllyasviel/control_v11p_sd15_inpaint/resolve/main/diffusion_pytorch_model.safetensors",
        "dest": "ComfyUI/models/controlnet/control_v11p_sd15_inpaint.safetensors"
    },
    {
        "url": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth",
        "dest": "ComfyUI/models/sams/sam_vit_h_4b8939.pth"
    },
    {
        "url": "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8x-oiv7.pt",
        "dest": "ComfyUI/models/ultralytics/bbox/yolov8x-oiv7.pt"
    }
]

if __name__ == "__main__":
    print("=== AI 모델 4종 다운로드 프로세스 시작 (재시도 로직 활성화) ===")
    try:
        for m in models_to_download:
            download_file(m["url"], m["dest"])
        print("\n모든 AI 모델 파일 다운로드가 정상 완료되었습니다.")
    except Exception as e:
        print(f"\n다운로드 중 치명적인 에러 발생: {e}")
        sys.exit(1)
