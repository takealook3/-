# =====================================================================
# [image_generation_service.py: Realistic Vision V6.0 B1 AI 화실 모듈]
# 비유: 실제 AI 화가(Realistic Vision 모델)를 화실에 모셔와서,
# 고객이 가져온 원본 방 사진 위에 지정된 스타일로 리모델링 페인팅(img2img)을 진행합니다.
# =====================================================================
import os
import gc
import time
from PIL import Image
from schemas import ErrorCode
from services.prompt_service import build_prompts

# 모델 파일이 위치할 절대 경로 설정 (요구사항 1번 준수)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "realisticVisionV60B1_v51VAE.safetensors")


class ModelServiceException(Exception):
    """서비스 계층 전용 예외 클래스 (API 계층의 AppException과 호환)"""
    def __init__(self, error_code: str, message: str, status_code: int = 500):
        super().__init__(message)
        self.error_code = error_code
        self.message = message
        self.status_code = status_code


class InteriorImageGenerator:
    """Realistic Vision V6.0 B1 모델을 관리하고 img2img 변환을 수행하는 싱글톤 화실 클래스"""
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.pipeline = None
        self.device = None

    def load_model(self):
        """Realistic Vision V6.0 B1 체크포인트를 메모리에 로딩합니다."""
        if self.pipeline is not None:
            return self.pipeline

        # 1. 모델 파일 존재 여부 검사
        if not os.path.exists(MODEL_PATH):
            raise ModelServiceException(
                error_code=ErrorCode.MODEL_NOT_FOUND,
                message=(
                    f"Realistic Vision V6.0 B1 모델 파일을 찾을 수 없습니다. (경로: {MODEL_PATH})\n"
                    "💡 [설치 및 다운로드 안내]\n"
                    "1) Civitai 또는 HuggingFace에서 'realisticVisionV60B1_v51VAE.safetensors' 다운로드\n"
                    f"2) {MODELS_DIR} 디렉터리에 파일 저장\n"
                    "3) 필수 라이브러리 설치: pip install torch diffusers transformers accelerate"
                ),
                status_code=404
            )

        # 2. 필수 라이브러리 임포트 검사
        try:
            import torch
            from diffusers import StableDiffusionImg2ImgPipeline
        except ImportError as e:
            raise ModelServiceException(
                error_code=ErrorCode.MODEL_LOAD_FAILED,
                message=f"필수 AI 패키지가 설치되지 않았습니다: {str(e)} (터미널에서 'pip install torch diffusers transformers accelerate'를 실행해 주세요.)",
                status_code=500
            )

        # 3. 디바이스 및 데이터 타입 최적화 설정
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if self.device == "cuda" else torch.float32

        if self.device == "cpu":
            print("⚠️ [Performance Warning] GPU(CUDA)를 찾을 수 없어 CPU 모드로 AI 화실을 가동합니다. 이미지 변환에 수 분 이상 소요될 수 있습니다.")
        else:
            print(f"🚀 [CUDA Enabled] GPU({torch.cuda.get_device_name(0)}) 모드로 고속 렌더링을 준비합니다.")

        # 4. 파이프라인 로드
        try:
            print(f"📥 [Model Loading] Realistic Vision V6.0 B1 ({MODEL_PATH}) 로딩 중...")
            self.pipeline = StableDiffusionImg2ImgPipeline.from_single_file(
                MODEL_PATH,
                torch_dtype=dtype,
                use_safetensors=True
            )
            self.pipeline.to(self.device)

            if self.device == "cuda":
                self.pipeline.enable_attention_slicing()

            print("✅ Realistic Vision V6.0 B1 모델 로딩 성공!")
        except Exception as e:
            raise ModelServiceException(
                error_code=ErrorCode.MODEL_LOAD_FAILED,
                message=f"Realistic Vision V6.0 B1 모델 로딩 중 치명적 오류가 발생했습니다: {str(e)}",
                status_code=500
            )

        return self.pipeline

    def transform_image(
        self,
        input_image_path: str,
        output_image_path: str,
        style: str,
        prompt: str,
        denoising_strength: float = 0.55,  # 요구사항 4번 권장 설정 준수 (0.55)
        guidance_scale: float = 7.5,       # 권장 설정 준수 (7~9)
        steps: int = 30,                   # 권장 설정 준수 (25~35)
        seed: int = None
    ) -> tuple[str, float]:
        """원본 이미지를 기반으로 Realistic Vision V6.0 B1 img2img 변환을 수행합니다."""
        start_time = time.time()

        if not os.path.exists(input_image_path):
            raise ModelServiceException(
                error_code=ErrorCode.IMAGE_NOT_FOUND,
                message=f"image_id에 해당하는 원본 이미지 파일을 찾을 수 없습니다: {input_image_path}",
                status_code=404
            )

        if self.pipeline is None:
            self.load_model()

        import torch
        pos_prompt, neg_prompt = build_prompts(style, prompt)
        print(f"🎨 [AI Render Start] Style: {style} | Denoise: {denoising_strength}\n   -> Positive: {pos_prompt}")

        try:
            init_img = Image.open(input_image_path).convert("RGB")
            w, h = init_img.size
            max_side = 768
            if max(w, h) > max_side:
                scale = max_side / float(max(w, h))
                w = int(w * scale)
                h = int(h * scale)
            w = (w // 8) * 8
            h = (h // 8) * 8
            init_img = init_img.resize((w, h), Image.Resampling.LANCZOS)

            if seed is None:
                import random
                seed = random.randint(0, 2**32 - 1)
            generator = torch.Generator(device=self.device).manual_seed(seed)

            output = self.pipeline(
                prompt=pos_prompt,
                negative_prompt=neg_prompt,
                image=init_img,
                strength=denoising_strength,
                guidance_scale=guidance_scale,
                num_inference_steps=steps,
                generator=generator
            )

            result_img = output.images[0]
            os.makedirs(os.path.dirname(output_image_path), exist_ok=True)
            result_img.save(output_image_path, format="JPEG", quality=95)

            elapsed = round(time.time() - start_time, 2)
            print(f"✨ [AI Render Done] 렌더링 완료 ({elapsed}초 소요) -> {output_image_path}")
            return pos_prompt, elapsed

        except Exception as e:
            err_msg = str(e).lower()
            if "out of memory" in err_msg or "oom" in err_msg:
                raise ModelServiceException(
                    error_code=ErrorCode.CUDA_OUT_OF_MEMORY,
                    message="GPU 메모리(VRAM)가 부족하여 이미지 변환에 실패했습니다. 해상도나 스텝 수를 조절해 주세요.",
                    status_code=500
                )
            raise ModelServiceException(
                error_code=ErrorCode.IMAGE_GENERATION_FAILED,
                message=f"Realistic Vision V6.0 B1 이미지 생성 중 오류가 발생했습니다: {str(e)}",
                status_code=500
            )
        finally:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()

    def inpaint_image(
        self,
        input_image_path: str,
        output_image_path: str,
        prompt: str,
        bbox: list = None,
        mask_data: list = None,
        denoising_strength: float = 0.75,  # 권장 인페인팅 설정 (0.65 ~ 0.85)
        guidance_scale: float = 8.0,       # 권장 인페인팅 설정 (7 ~ 9)
        steps: int = 30,                   # 권장 인페인팅 설정 (25 ~ 35)
        mask_blur: int = 12,               # 권장 마스크 블러 (8 ~ 16)
        seed: int = None
    ) -> tuple[str, float]:
        """
        [부분 가구 교체 수선 창구 (Inpainting)]
        사용자가 드래그로 지정한 영역(bbox/mask) 내 가구만 Realistic Vision V6.0 B1으로 교체하며,
        마스크 바깥쪽(방 구조, 창문, 벽, 바닥 등)은 100% 원본 픽셀로 완벽히 보존합니다.
        """
        start_time = time.time()

        if not os.path.exists(input_image_path):
            raise ModelServiceException(
                error_code=ErrorCode.IMAGE_NOT_FOUND,
                message=f"image_id에 해당하는 원본 이미지 파일을 찾을 수 없습니다: {input_image_path}",
                status_code=404
            )

        if not bbox and not mask_data:
            raise ModelServiceException(
                error_code=ErrorCode.MASK_REQUIRED,
                message="수정할 가구 영역(마스크 또는 박스)이 지정되지 않았습니다.",
                status_code=400
            )

        # 모델 파이프라인 로딩 확인
        if self.pipeline is None:
            self.load_model()

        import torch
        from PIL import Image, ImageDraw, ImageFilter

        pos_prompt = f"realistic interior furniture replacement, {prompt}, photorealistic, matching room lighting, natural shadow, high quality, realistic texture"
        neg_prompt = "blurry, distorted, broken furniture, unrealistic, bad perspective, duplicated object, messy room, watermark, text, logo, artifacts"
        print(f"🖌️ [AI Inpaint Start] Prompt: {prompt}\n   -> Positive: {pos_prompt}")

        try:
            init_img = Image.open(input_image_path).convert("RGB")
            orig_w, orig_h = init_img.size

            # 마스크 흑백 이미지 생성 (선택 영역: 흰색 255, 외부 배경: 검은색 0)
            mask_img = Image.new("L", (orig_w, orig_h), 0)
            draw = ImageDraw.Draw(mask_img)

            if bbox and len(bbox) == 4:
                x1, y1, x2, y2 = bbox
                draw.rectangle([x1, y1, x2, y2], fill=255)
            elif mask_data and len(mask_data) == 4:
                x1, y1, x2, y2 = mask_data
                draw.rectangle([x1, y1, x2, y2], fill=255)

            # 권장 설정: mask blur 8~16 적용하여 경계선 부드럽게 처리
            blurred_mask = mask_img.filter(ImageFilter.GaussianBlur(mask_blur))

            # AI 처리용 리사이즈 (8 배수 맞춤)
            w, h = orig_w, orig_h
            max_side = 768
            if max(w, h) > max_side:
                scale = max_side / float(max(w, h))
                w, h = int(w * scale), int(h * scale)
            w, h = (w // 8) * 8, (h // 8) * 8

            proc_img = init_img.resize((w, h), Image.Resampling.LANCZOS)
            proc_mask = blurred_mask.resize((w, h), Image.Resampling.LANCZOS)

            if seed is None:
                import random
                seed = random.randint(0, 2**32 - 1)
            generator = torch.Generator(device=self.device).manual_seed(seed)

            # Stable Diffusion Inpainting 수행
            output = self.pipeline(
                prompt=pos_prompt,
                negative_prompt=neg_prompt,
                image=proc_img,
                mask_image=proc_mask,
                strength=denoising_strength,
                guidance_scale=guidance_scale,
                num_inference_steps=steps,
                generator=generator
            )

            res_img = output.images[0].resize((orig_w, orig_h), Image.Resampling.LANCZOS)

            # 💡 [핵심 기술 요구사항 준수]: 마스크 영역 바깥은 100% 원본 유지!
            final_img = Image.composite(res_img, init_img, blurred_mask)

            os.makedirs(os.path.dirname(output_image_path), exist_ok=True)
            final_img.save(output_image_path, format="JPEG", quality=95)

            elapsed = round(time.time() - start_time, 2)
            print(f"✨ [AI Inpaint Done] 선택 영역 수정 완료 ({elapsed}초 소요) -> {output_image_path}")
            return pos_prompt, elapsed

        except Exception as e:
            err_msg = str(e).lower()
            if "out of memory" in err_msg or "oom" in err_msg:
                raise ModelServiceException(
                    error_code=ErrorCode.CUDA_OUT_OF_MEMORY,
                    message="GPU 메모리(VRAM)가 부족하여 인페인팅 생성에 실패했습니다.",
                    status_code=500
                )
            raise ModelServiceException(
                error_code=ErrorCode.INPAINTING_FAILED,
                message=f"Realistic Vision V6.0 B1 부분 가구 수정 중 오류가 발생했습니다: {str(e)}",
                status_code=500
            )
        finally:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()

