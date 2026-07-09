# =====================================================================
# evaluation_service.py: AI 이미지 생성 결과 정량평가 전용 서비스 모듈
# 비유: 주방에서 완성된 요리(생성 이미지)가 손님에게 나가기 전에, 
# '주문과 일치하는지(CLIP)', '화질 손상이 없는지(PSNR)', '뼈대가 유지되었는지(SSIM)'
# 자동 검사대에서 채점하여 영수증(API 응답)에 점수를 찍어주는 역할을 합니다.
# =====================================================================

import os
import sys
import time
from typing import Optional, Dict, Any
from PIL import Image
import numpy as np

# Windows 터미널(cp949) 환경에서 유니코드/이모지 출력 에러(UnicodeEncodeError)를 방지하기 위한 인코딩 안전 설정
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# [주의사항 주석 - PSNR]
# PSNR(Peak Signal-to-Noise Ratio)은 이미지 변환 작업에서 절대적인 화질 품질 지표가 아니라,
# 원본 이미지 대비 픽셀 변화 정도를 참고하는 '보조 지표'입니다. 
# 인테리어 스타일 변환은 색상과 가구 구조가 의도적으로 변경되므로 PSNR 수치가 낮아질 수 있으며, 
# 이는 품질 하락이 아닌 '스타일 변환 폭이 큼'을 의미할 수 있습니다.

# [주의사항 주석 - KID]
# KID(Kernel Inception Distance)는 개별 이미지 단일 건 단위의 평가 지표가 아니라,
# '이미지 집합(Batch) 전체의 특징 분포'를 원본 데이터셋 분포와 비교하는 지표입니다.
# 따라서 실시간 API 1건 응답에는 넣지 않고, 추후 대량의 생성 이미지들을 모아 배치 평가(Batch Evaluation)를 
# 진행할 때 추가하는 지표로 활용 가능합니다.

# 전역 변수로 모델과 프로세서를 캐싱하여 매 요청마다 재로딩하는 시간을 절약합니다.
_clip_model = None
_clip_processor = None
_clip_device = None

def _load_clip_model():
    """CLIP 모델과 프로세서를 메모리에 싱글톤(Singleton)으로 로드하고 GPU/CPU를 자동 설정합니다."""
    global _clip_model, _clip_processor, _clip_device
    if _clip_model is not None and _clip_processor is not None:
        return _clip_model, _clip_processor, _clip_device

    try:
        import torch
        from transformers import CLIPProcessor, CLIPModel

        # GPU가 있으면 cuda, 없으면 cpu를 사용해줍니다. (요구사항 6)
        _clip_device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[Evaluation Service] CLIP 모델 로딩 시작... (연산 장치: {_clip_device})")
        
        model_name = "openai/clip-vit-base-patch32" # (요구사항 3)
        _clip_processor = CLIPProcessor.from_pretrained(model_name)
        _clip_model = CLIPModel.from_pretrained(model_name).to(_clip_device)
        _clip_model.eval() # 평가 모드 전환
        
        print(f"[Evaluation Service] CLIP 모델 로딩 완료!")
        return _clip_model, _clip_processor, _clip_device
    except Exception as e:
        print(f"[Evaluation Service] CLIP 모델 로딩 실패: {e}")
        return None, None, "cpu"

def evaluate_generated_image(
    original_image_path: Optional[str],
    generated_image_path: str,
    prompt: str
) -> Optional[Dict[str, Any]]:
    """
    [이미지 정량평가 핵심 함수] (요구사항 2)
    원본 이미지, 생성 이미지, 프롬프트를 입력받아 CLIP Score, PSNR, SSIM을 계산하여 반환합니다.
    에러가 발생해도 전체 생성 로직이 중단되지 않도록 예외 처리하며, 실패 시 error 메시지 또는 None을 반환합니다. (요구사항 11)
    """
    t_start = time.time()
    print(f"[Evaluation Service] 정량평가 시작 - 대상: {os.path.basename(generated_image_path)}")
    
    # 생성 이미지가 존재하지 않으면 평가 불가
    if not os.path.exists(generated_image_path):
        print(f"[Evaluation Service] 생성 이미지 파일이 존재하지 않습니다: {generated_image_path}")
        return {"error": "생성 이미지 파일을 찾을 수 없어 평가를 진행할 수 없습니다."}

    try:
        import torch

        # 1. 생성 이미지 열기 및 RGB 모드 변환, 512x512 리사이징 (요구사항 5)
        with Image.open(generated_image_path) as gen_img:
            gen_img_rgb = gen_img.convert("RGB")
            gen_img_512 = gen_img_rgb.resize((512, 512), Image.Resampling.LANCZOS)
            gen_arr = np.array(gen_img_512)

        # 2. CLIP Score 계산 (텍스트 프롬프트와 생성 이미지 간의 의미적 일치도)
        clip_score_val = None
        if prompt and prompt.strip():
            model, processor, device = _load_clip_model()
            if model and processor:
                try:
                    # 프로세서로 이미지와 텍스트 전처리
                    # truncation: CLIP 텍스트 인코더의 최대 길이(77토큰)를 넘는 프롬프트(특히 한글 장문)가
                    # 들어오면 예외로 죽어 점수가 N/A가 되던 문제를 방지 — 앞부분 77토큰만 사용
                    inputs = processor(
                        text=[prompt], images=gen_img_512, return_tensors="pt",
                        padding=True, truncation=True, max_length=77
                    ).to(device)
                    with torch.no_grad():
                        outputs = model(**inputs)
                        # 이미지와 텍스트 간의 코사인 유사도 추출
                        image_embeds = outputs.image_embeds / outputs.image_embeds.norm(dim=-1, keepdim=True)
                        text_embeds = outputs.text_embeds / outputs.text_embeds.norm(dim=-1, keepdim=True)
                        cosine_sim = torch.cosine_similarity(image_embeds, text_embeds, dim=-1)
                        clip_score_val = round(float(cosine_sim.item()), 3)
                        print(f"[Evaluation] CLIP Score 계산 완료: {clip_score_val}")
                except Exception as clip_err:
                    print(f"[Evaluation] CLIP Score 연산 중 오류: {clip_err}")
                    clip_score_val = None

        # 3. PSNR 및 SSIM 계산 (원본 이미지가 있는 경우에만 수행, T2I는 원본이 없으므로 null 처리)
        psnr_val = None
        ssim_val = None
        
        if original_image_path and os.path.exists(original_image_path):
            try:
                # [방어적 임포트] skimage(scikit-image) 미설치 환경에서도 CLIP Score까지 죽지 않도록,
                # PSNR/SSIM 연산 직전에만 임포트한다. (과거: 함수 최상단 임포트 실패 → 전 지표 N/A)
                from skimage.metrics import peak_signal_noise_ratio, structural_similarity

                with Image.open(original_image_path) as orig_img:
                    orig_img_rgb = orig_img.convert("RGB")
                    orig_img_512 = orig_img_rgb.resize((512, 512), Image.Resampling.LANCZOS)
                    orig_arr = np.array(orig_img_512)

                # PSNR 계산 (skimage.metrics.peak_signal_noise_ratio) (요구사항 4)
                # 원본과 생성 이미지 간의 픽셀 차이 비율 (보조 지표)
                psnr_raw = peak_signal_noise_ratio(orig_arr, gen_arr, data_range=255)
                # 원본과 생성 이미지가 사실상 동일하면 PSNR이 inf가 되는데, inf는 JSON 표준에 없어
                # 응답 직렬화/프론트 파싱을 깨뜨린다 → 관례적 상한값 99.0dB로 캡핑
                if not np.isfinite(psnr_raw):
                    psnr_raw = 99.0
                psnr_val = round(float(psnr_raw), 2)
                
                # SSIM 계산 (skimage.metrics.structural_similarity) (요구사항 4)
                # 다중 채널(RGB)이므로 channel_axis=2 지정
                ssim_raw = structural_similarity(orig_arr, gen_arr, data_range=255, channel_axis=2)
                ssim_val = round(float(ssim_raw), 3)
                
                print(f"[Evaluation] PSNR: {psnr_val} dB | SSIM: {ssim_val}")
            except Exception as metric_err:
                print(f"[Evaluation] PSNR/SSIM 연산 중 오류: {metric_err}")
                psnr_val = None
                ssim_val = None
        else:
            print("[Evaluation] 원본 이미지 경로가 없거나 존재하지 않아 PSNR/SSIM은 계산하지 않습니다. (Text-to-Image 모드)")

        t_elapsed = round(time.time() - t_start, 2)
        print(f"[Evaluation Service] 정량평가 완료 (소요시간: {t_elapsed}초)")

        # [CLIP 점수 백분율화] 이미지-텍스트 코사인 유사도의 실용 범위는 0.2~0.35라
        # 그대로 100을 곱하면(24점) 좋은 결과도 낙제점처럼 보인다.
        # 표준 CLIPScore 정의(Hessel et al. 2021: 2.5 x max(cos, 0), 상한 1.0)를 백분율로 제공한다.
        clip_score_pct = None
        if clip_score_val is not None:
            clip_score_pct = round(min(max(clip_score_val, 0.0) * 2.5, 1.0) * 100)

        # 최종 반환 규격 (요구사항 8)
        return {
            "clip_score": clip_score_val,
            "clip_score_pct": clip_score_pct,
            "psnr": psnr_val,
            "ssim": ssim_val
        }

    except Exception as e:
        # 에러가 발생해도 이미지 생성 결과 자체는 반환되도록 error 메시지 포함 딕셔너리 반환 (요구사항 11)
        print(f"[Evaluation Service Error] 정량평가 수행 실패: {e}")
        import traceback
        traceback.print_exc()
        return {"error": f"정량평가 연산 중 오류가 발생했습니다: {str(e)}"}
