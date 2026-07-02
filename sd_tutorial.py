# -*- coding: utf-8 -*-
"""
Stable Diffusion (.safetensors) 모델을 로드하여
1. 이미지 스타일 변경 (Img2Img)
2. 이미지 특정 부분 수정 (Inpainting)
을 수행하는 파이썬 예제 코드입니다.

[요구사항]
- pip install torch diffusers transformers accelerate safetensors omega-conf-loader
"""

import os
import torch
from PIL import Image
# Hugging Face diffusers 라이브러리에서 파이프라인 가져오기
from diffusers import StableDiffusionImg2ImgPipeline, StableDiffusionInpaintPipeline


def run_interior_style_change(
    model_path: str, 
    input_image_path: str, 
    output_image_path: str,
    prompt: str,
    negative_prompt: str = ""
):
    """
    1. 인테리어 스타일 변경 (Image-to-Image)
    - 원본 이미지의 구조를 바탕으로 새로운 스타일의 인테리어 이미지를 생성합니다.
    """
    print("🎨 [1/2] 인테리어 스타일 변경 작업을 시작합니다...")
    
    # 1. 원본 방 사진 이미지 로드 및 크기 조정
    if not os.path.exists(input_image_path):
        raise FileNotFoundError(f"원본 이미지를 찾을 수 없습니다: {input_image_path}")
        
    init_image = Image.open(input_image_path).convert("RGB")
    # AI 연산을 원활하게 하기 위해 이미지를 512x512 또는 768x768 등 8의 배수 크기로 리사이즈합니다.
    init_image = init_image.resize((712, 512)) 

    # 2. GPU(CUDA) 가용 여부 확인
    # GPU(NVIDIA 그래픽카드)가 있다면 cuda를 사용하고, 없다면 CPU를 사용합니다.
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"🖥️ 사용 장치: {device}")

    # 3. 단일 .safetensors 파일로부터 Img2Img 파이프라인 로드
    # 'from_single_file' 메서드는 로컬에 다운로드받은 .safetensors 파일을 직접 불러올 때 사용합니다.
    print(f"📦 모델 로드 중: {model_path}")
    pipe = StableDiffusionImg2ImgPipeline.from_single_file(
        model_path,
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        use_safetensors=True
    )
    pipe = pipe.to(device)

    # 4. 이미지 생성 수행
    # - strength: 원본 이미지를 얼마나 변경할지 결정하는 강도 (0.0 ~ 1.0)
    #             0.0에 가까우면 원본과 똑같고, 1.0에 가까우면 원본 형태를 거의 무시하고 프롬프트대로만 그립니다.
    #             보통 인테리어 구조를 유지하려면 0.35 ~ 0.55 사이를 추천합니다.
    # - guidance_scale: 프롬프트(명령어)를 얼마나 엄격하게 따를지 결정합니다. (보통 7.5)
    print("⚡ 이미지 생성 중...")
    generator = torch.Generator(device=device).manual_seed(42) # 동일한 결과를 얻기 위해 시드 고정
    
    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        image=init_image,
        strength=0.5,
        guidance_scale=7.5,
        generator=generator
    ).images[0]

    # 5. 결과 이미지 저장
    result.save(output_image_path)
    print(f"✅ 스타일 변환 성공! 저장 경로: {output_image_path}\n")


def run_interior_inpainting(
    inpaint_model_path: str,
    input_image_path: str,
    mask_image_path: str,
    output_image_path: str,
    prompt: str,
    negative_prompt: str = ""
):
    """
    2. 이미지 부분 수정 (Inpainting)
    - 마스크 이미지로 가리킨 영역(흰색 부분)만 지우고 새로운 요소(예: 다른 가구)를 그려 넣습니다.
    """
    print("🖌️ [2/2] 이미지 부분 수정(Inpainting) 작업을 시작합니다...")

    # 1. 원본 이미지와 마스크 이미지 로드
    if not os.path.exists(input_image_path) or not os.path.exists(mask_image_path):
        raise FileNotFoundError("원본 이미지 또는 마스크 이미지를 찾을 수 없습니다.")

    init_image = Image.open(input_image_path).convert("RGB").resize((512, 512))
    # 마스크 이미지는 흑백(L) 모드로 변환합니다. (수정할 부분은 흰색, 유지할 부분은 검은색)
    mask_image = Image.open(mask_image_path).convert("L").resize((512, 512))

    # 2. GPU 가용 여부 확인
    device = "cuda" if torch.cuda.is_available() else "cpu"

    # 3. 단일 .safetensors 파일로부터 Inpaint 파이프라인 로드
    # 인페인팅 작업을 할 때는 이름 뒤에 '-inpainting.safetensors'가 들어간 모델을 로드해야 가장 깔끔하게 합성됩니다.
    print(f"📦 인페인팅 모델 로드 중: {inpaint_model_path}")
    pipe = StableDiffusionInpaintPipeline.from_single_file(
        inpaint_model_path,
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        use_safetensors=True
    )
    pipe = pipe.to(device)

    # 4. 인페인팅 수행
    # 프롬프트에 "a modern luxury leather sofa"와 같이 마스크 영역에 새로 넣고 싶은 가구를 묘사합니다.
    print("⚡ 부분 수정(인페인팅) 생성 중...")
    generator = torch.Generator(device=device).manual_seed(42)

    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        image=init_image,
        mask_image=mask_image,
        guidance_scale=7.5,
        generator=generator
    ).images[0]

    # 5. 결과 이미지 저장
    result.save(output_image_path)
    print(f"✅ 부분 수정 성공! 저장 경로: {output_image_path}\n")


# === 💡 대화식 실행부 ===
if __name__ == "__main__":
    print("==================================================")
    print("🏠 AI 2D 인테리어 이미지 변환기 🏠")
    print("==================================================")
    print("원하는 작업의 번호를 선택하세요:")
    print("1. [Img2Img] 전체 인테리어 스타일 변경 (기존 구조 유지)")
    print("2. [Inpainting] 부분 가구 교체 및 수정 (마스크 영역만 변경)")
    
    choice = input("👉 선택 (1 또는 2): ").strip()
    
    if choice not in ["1", "2"]:
        print("❌ 잘못된 선택입니다. 프로그램을 종료합니다.")
        exit()
        
    # 공통 입력 항목 (엔터 입력 시 기본 사용자 다운로드 폴더 경로 사용)
    default_base_model = r"C:\Users\USER\Downloads\realisticVisionV60B1_v51HyperVAE.safetensors"
    default_inpaint_model = r"C:\Users\USER\Downloads\realisticVisionV60B1_v51HyperInpaintVAE.safetensors"
    
    if choice == "1":
        print(f"📦 기본 모델 경로: {default_base_model}")
        model_path = input("👉 .safetensors 모델 파일 경로 (엔터 키 입력 시 기본 경로 적용): ").strip()
        if not model_path:
            model_path = default_base_model
    else:
        print(f"📦 기본 인페인트 모델 경로: {default_inpaint_model}")
        model_path = input("👉 .safetensors 인페인트 모델 파일 경로 (엔터 키 입력 시 기본 경로 적용): ").strip()
        if not model_path:
            model_path = default_inpaint_model
            
    # 경로에서 양 끝의 따옴표 제거 (드래그 앤 드롭 대비)
    model_path = model_path.replace('"', '').replace("'", "")
    
    if not os.path.exists(model_path):
        print(f"❌ 원본 모델 파일을 찾을 수 없습니다: {model_path}")
        print("💡 다운로드 폴더에 해당 .safetensors 파일이 있는지 확인해 주세요.")
        exit()
        
    input_image_path = input("🖼️ 원본 방 이미지 파일(.jpg/.png)의 경로를 입력하세요: ").strip()
    input_image_path = input_image_path.replace('"', '').replace("'", "")
    
    if not os.path.exists(input_image_path):
        print(f"❌ 원본 이미지 파일을 찾을 수 없습니다: {input_image_path}")
        exit()

    output_image_path = input("💾 결과 이미지를 저장할 경로와 파일명을 입력하세요 (예: result.jpg): ").strip()
    output_image_path = output_image_path.replace('"', '').replace("'", "")

    prompt = input("✍️ 생성할 인테리어 스타일 프롬프트(영어)를 입력하세요: ").strip()
    negative_prompt = input("🚫 제외할 요소(부정 프롬프트, 엔터 키 입력 시 기본값 적용): ").strip()
    if not negative_prompt:
        negative_prompt = "blurry, low quality, distorted, bad proportions, ugly, disfigured"

    try:
        if choice == "1":
            # 전체 인테리어 스타일 변경 실행
            run_interior_style_change(
                model_path=model_path,
                input_image_path=input_image_path,
                output_image_path=output_image_path,
                prompt=prompt,
                negative_prompt=negative_prompt
            )
        elif choice == "2":
            # 부분 영역 수정(인페인팅) 실행
            mask_image_path = input("🖌️ 마스크 이미지 파일(.png/.jpg)의 경로를 입력하세요: ").strip()
            mask_image_path = mask_image_path.replace('"', '').replace("'", "")
            
            if not os.path.exists(mask_image_path):
                print(f"❌ 마스크 이미지를 찾을 수 없습니다: {mask_image_path}")
                exit()
                
            run_interior_inpainting(
                inpaint_model_path=model_path,
                input_image_path=input_image_path,
                mask_image_path=mask_image_path,
                output_image_path=output_image_path,
                prompt=prompt,
                negative_prompt=negative_prompt
            )
    except Exception as e:
        print("\n💥 오류가 발생했습니다!")
        print(f"원인: {e}")
        print("해결 방안: 필수 라이브러리(torch, diffusers 등)가 설치되었는지 확인하고, 입력하신 모델 파일이 정상적인 Stable Diffusion 1.5 기반 모델인지 확인해 주세요.")

