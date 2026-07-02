# -*- coding: utf-8 -*-
"""
ComfyUI API 연동 이미지 입출력 예제 코드 (웹 화면 직접 입력 연동 버전)

[동작 방식 비유]
1. ComfyUI 웹 화면(http://127.0.0.1:8188)에서 마우스로 사진을 업로드하고 마스크(오려낼 영역)를 직접 칠합니다.
2. 파이썬 리모컨(이 코드)을 실행하여 해당 이미지 파일 이름을 입력합니다.
3. 파이썬이 ComfyUI 서버에 원격으로 "그림 그리기 시작해!" 라고 명령을 보냅니다.
4. 생성이 완료되면 완성된 이미지를 낚아채어 내 컴퓨터 폴더에 자동으로 다운로드 저장합니다.

[요구사항]
- ComfyUI 서버가 실행 중이어야 합니다. (기본 주소: http://127.0.0.1:8188)
- pip install requests
"""

import json
import urllib.request
import urllib.parse
import os
import time
import sys  # 시스템 출력을 제어하기 위해 추가
import argparse  # 명령행 인자(옵션) 분석을 위한 라이브러리 추가
import requests  # ComfyUI 서버에 파일 업로드를 하기 위한 라이브러리 추가

# 윈도우 터미널에서 이모지 및 한글이 깨지지 않고 출력되도록 설정합니다.
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        # Python 3.7 이전 버전 대응
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ComfyUI 서버 기본 주소
COMFYUI_SERVER = "127.0.0.1:8188"
CLIENT_ID = "interior_agent_client" # 클라이언트 구분용 ID


def upload_image(image_path: str):
    """
    0단계: 로컬 컴퓨터에 있는 이미지 파일을 ComfyUI 서버의 input 폴더로 자동 업로드합니다.
    """
    print(f"[INFO] ComfyUI 서버로 이미지 파일 업로드 중... ({os.path.basename(image_path)})")
    url = f"http://{COMFYUI_SERVER}/upload/image"
    
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"업로드할 로컬 이미지를 찾을 수 없습니다: {image_path}")
        
    with open(image_path, 'rb') as f:
        files = {
            'image': (os.path.basename(image_path), f, 'image/jpeg'),
            'overwrite': (None, 'true')
        }
        response = requests.post(url, files=files)
        
    if response.status_code == 200:
        result = response.json()
        server_filename = result['name']
        print(f"[SUCCESS] 이미지 업로드 완료! 서버 파일명: {server_filename}")
        return server_filename
    else:
        raise ConnectionError(f"이미지 업로드 실패 (HTTP {response.status_code}): {response.text}")


def send_prompt_workflow(workflow_json: dict):
    """
    1단계: 변환 명령이 담긴 워크플로우 JSON(주문서)을 ComfyUI 서버에 전송합니다.
    """
    print("[INFO] ComfyUI 서버에 인테리어 변환 명령 전송 중...")
    url = f"http://{COMFYUI_SERVER}/prompt"
    
    payload = {
        "prompt": workflow_json,
        "client_id": CLIENT_ID
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            
        prompt_id = result['prompt_id']
        print(f"[SUCCESS] 주문 접수 완료! 대기열 ID: {prompt_id}")
        return prompt_id
    except urllib.error.HTTPError as e:
        # ComfyUI 서버가 400 Bad Request와 함께 보낸 상세 에러 내역을 읽어서 출력합니다.
        error_body = e.read().decode('utf-8')
        print("\n❌ ComfyUI 서버에서 주문서 검증 실패 (400 Bad Request)!")
        try:
            # 에러가 JSON 포맷일 경우 보기 편하게 정렬하여 출력합니다.
            error_json = json.loads(error_body)
            print(json.dumps(error_json, indent=2, ensure_ascii=False))
        except Exception:
            print(f"상세 에러 내용: {error_body}")
        raise e


def wait_for_image_generation(prompt_id: str):
    """
    2단계: AI 그림이 완성될 때까지 주기적으로 확인하며 대기(폴링)합니다.
    """
    print("⏳ AI 화가가 그림을 그리는 중입니다. 잠시만 기다려주세요...")
    history_url = f"http://{COMFYUI_SERVER}/history/{prompt_id}"
    
    while True:
        time.sleep(1) # 1초에 한 번씩 완료 확인
        
        req = urllib.request.Request(history_url)
        try:
            with urllib.request.urlopen(req) as response:
                history = json.loads(response.read().decode('utf-8'))
        except Exception:
            # 일시적인 통신 네트워크 지연 대처
            continue
            
        if prompt_id in history:
            print("[INFO] 그림 그리기 완료!")
            outputs = history[prompt_id]['outputs']
            output_images = []
            
            for node_id in outputs:
                node_output = outputs[node_id]
                if 'images' in node_output:
                    for img in node_output['images']:
                        output_images.append(img['filename'])
            return output_images


def download_result_image(filename: str, save_path: str):
    """
    3단계: 완성되어 서버가 들고 있는 이미지를 내 컴퓨터로 자동 저장(다운로드)합니다.
    """
    print(f"[INFO] 완성된 이미지 다운로드 중... ({filename})")
    params = urllib.parse.urlencode({'filename': filename, 'type': 'output'})
    url = f"http://{COMFYUI_SERVER}/view?{params}"
    
    urllib.request.urlretrieve(url, save_path)
    print(f"[SUCCESS] 결과 저장 완료! 저장 경로: {os.path.abspath(save_path)}")


if __name__ == "__main__":
    # 1. 명령행 인자 설정 (터미널에서 --image 등의 옵션으로 직접 값을 넘겨받을 수 있게 함)
    parser = argparse.ArgumentParser(description="ComfyUI 원격 이미지 변환 리모컨 (2단계 맞교환 통합형)")
    parser.add_argument("--image", type=str, help="ComfyUI 웹 브라우저에 업로드한 원본 이미지 파일명")
    parser.add_argument("--output", type=str, default="result.jpg", help="저장할 결과 이미지 파일명 (기본값: result.jpg)")
    parser.add_argument("--prompt", type=str, help="1차로 바꿀 가구 묘사 프롬프트 (영어)")
    parser.add_argument("--prompt-b", type=str, help="2차로 바꿀 가구 묘사 프롬프트 (영어)")
    args = parser.parse_args()

    print("==================================================")
    print("🏠 ComfyUI 원격 이미지 변환 리모컨 (2단계 맞교환 통합형) 🏠")
    print("==================================================")
    
    # 2. 실행 모드 분기 (명령행 인자가 전달되었으면 대화식 입력을 건너뜁니다)
    if args.image:
        uploaded_filename = args.image
        output_filename = args.output
        prompt = args.prompt if args.prompt else "A tall green monstera plant in a pot, highly detailed, 8k"
        prompt_b = args.prompt_b if args.prompt_b else "A modern luxury leather sofa, highly detailed, 8k"
        print(f"🚀 [명령행 모드 실행] 이미지: {uploaded_filename} | 결과 저장: {output_filename}")
        print(f"✍️ 1차 프롬프트: {prompt}")
        print(f"✍️ 2차 프롬프트: {prompt_b}\n")
    else:
        # 대화식 모드: 사용자가 직접 입력합니다.
        uploaded_filename = input("👉 원본 이미지 파일 경로를 입력하세요 (예: my_room.jpg): ").strip()
        if not uploaded_filename:
            print("[ERROR] 이미지 파일명을 반드시 입력해야 합니다.")
            exit()
            
        output_filename = input("💾 저장할 결과 이미지 파일명을 입력하세요 (기본값: result.jpg): ").strip()
        if not output_filename:
            output_filename = "result.jpg"
            
        prompt = input("✍️ 1차로 바꿀 가구 설명 프롬프트(영어, 엔터 키 입력 시 기본 화분): ").strip()
        if not prompt:
            prompt = "A tall green monstera plant in a pot, highly detailed, 8k"
            
        prompt_b = input("✍️ 2차로 바꿀 가구 설명 프롬프트(영어, 엔터 키 입력 시 기본 소파): ").strip()
        if not prompt_b:
            prompt_b = "A modern luxury leather sofa, highly detailed, 8k"

    # 3. 로컬에 파일이 실존한다면 ComfyUI 서버로 자동 배달(업로드)합니다.
    if os.path.exists(uploaded_filename):
        try:
            uploaded_filename = upload_image(uploaded_filename)
        except Exception as e:
            print(f"⚠️ [WARNING] 파일 자동 업로드 중 실패했습니다: {e}")
            print("💡 웹 브라우저에서 직접 이미지를 올린 경우라면 계속 진행을 시도합니다.")

    # 4. ComfyUI 기본 API 워크플로우 템플릿 (2단계 인페인팅 릴레이 구성)
    workflow_template = {
        "4": { # 모델 불러오기 노드 (체크포인트)
            "inputs": {
                "ckpt_name": "realisticVisionV60B1_v51HyperInpaintVAE.safetensors"
            },
            "class_type": "CheckpointLoaderSimple"
        },
        "5": { # 이미지 불러오기 노드 1 (1차 마스크 A 대상)
            "inputs": {
                "image": uploaded_filename 
            },
            "class_type": "LoadImage"
        },
        "11": { # 이미지 불러오기 노드 2 (2차 마스크 B 대상 - 동일 이미지 사용)
            "inputs": {
                "image": uploaded_filename 
            },
            "class_type": "LoadImage"
        },
        "6": { # 1차 긍정 프롬프트 (첫 번째 가구 변경용)
            "inputs": {
                "text": prompt,
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "7": { # 1차 부정 프롬프트
            "inputs": {
                "text": "blurry, low quality, distorted, bad proportions, dark",
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "10": { # 1차 VAE Encode 노드 (1차 마스크 영역 인코딩)
            "inputs": {
                "pixels": ["5", 0],
                "vae": ["4", 2],
                "mask": ["5", 1] # LoadImage 1의 MASK 포트
            },
            "class_type": "VAEEncodeForInpaint"
        },
        "3": { # 1차 KSampler 노드 (1단계 생성)
            "inputs": {
                "seed": 42,
                "steps": 6,
                "cfg": 1.5,
                "sampler_name": "dpmpp_sde",
                "scheduler": "karras",
                "denoise": 0.6,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["10", 0]
            },
            "class_type": "KSampler"
        },
        "8": { # 1차 VAE Decode 노드 (1단계 완성 결과 출력)
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEDecode"
        },
        "12": { # 2차 긍정 프롬프트 (두 번째 가구 변경용)
            "inputs": {
                "text": prompt_b,
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "13": { # 2차 부정 프롬프트
            "inputs": {
                "text": "blurry, low quality, distorted, bad proportions, dark",
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "14": { # 2차 VAE Encode 노드 (1차 완성 결과와 마스크 B 연결)
            "inputs": {
                "pixels": ["8", 0], # 1차 VAE Decode 결과 IMAGE
                "vae": ["4", 2],
                "mask": ["11", 1] # LoadImage 2의 MASK 포트
            },
            "class_type": "VAEEncodeForInpaint"
        },
        "15": { # 2차 KSampler 노드 (2단계 최종 생성)
            "inputs": {
                "seed": 42,
                "steps": 6,
                "cfg": 1.5,
                "sampler_name": "dpmpp_sde",
                "scheduler": "karras",
                "denoise": 0.6,
                "model": ["4", 0],
                "positive": ["12", 0],
                "negative": ["13", 0],
                "latent_image": ["14", 0]
            },
            "class_type": "KSampler"
        },
        "16": { # 2차 VAE Decode 노드 (최종 완성 결과 출력)
            "inputs": {
                "samples": ["15", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEDecode"
        },
        "9": { # 최종 이미지 저장 노드
            "inputs": {
                "filename_prefix": "InpaintResult_2step",
                "images": ["16", 0]
            },
            "class_type": "SaveImage"
        }
    }

    try:
        # [Step 1] ComfyUI 서버에 조작 명령 전송
        prompt_id = send_prompt_workflow(workflow_template)
        
        # [Step 2] 완성될 때까지 대기
        generated_filenames = wait_for_image_generation(prompt_id)
        
        # [Step 3] 완성된 이미지를 지정 경로로 받아와서 저장
        if generated_filenames:
            download_result_image(generated_filenames[0], output_filename)
            print("\n🎉 2단계 맞교환 연동 처리가 무사히 완료되었습니다!")
        else:
            print("[ERROR] 생성된 결과 이미지를 찾을 수 없습니다.")
            
    except Exception as e:
        print(f"\n[ERROR] ComfyUI 연동 중 오류 발생: {e}")
        print("💡 ComfyUI 서버가 정상 작동 중인지, 모델명이 맞는지 확인해 주세요.")
