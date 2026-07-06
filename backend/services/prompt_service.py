# =====================================================================
# [prompt_service.py: 인테리어 프롬프트 조율 및 통역사 모듈]
# 비유: 한국어 고객 의뢰서("밝고 미니멀한 거실로 바꿔줘")를 외국인 AI 화가(Stable Diffusion)가
# 직관적으로 이해하고 최고의 화풍으로 표현할 수 있도록 전문 영문 미술 지시서로 번역해 줍니다.
# =====================================================================
import re

# 1. 5대 핵심 인테리어 스타일별 맞춤 키워드 매핑
STYLE_MAPPINGS = {
    "modern": "modern interior design, clean lines, bright, minimal, premium apartment",
    "minimal": "minimalist interior, simple furniture, clean white space, calm mood",
    "natural": "natural wood interior, warm lighting, plants, cozy atmosphere",
    "vintage": "vintage interior design, warm tone, classic furniture, retro mood",
    "scandinavian": "scandinavian interior, white and wood tone, cozy, simple, natural light"
}

# 2. 사진 품질을 떨어뜨리는 요소를 막는 기본 부정(Negative) 프롬프트
DEFAULT_NEGATIVE_PROMPT = (
    "low quality, blurry, distorted, bad anatomy, unrealistic, overexposed, underexposed, "
    "watermark, text, logo, duplicate objects, broken furniture, deformed room, messy layout"
)

# 3. 한국어 -> 영어 인테리어 핵심 키워드 사전
KOREAN_INTERIOR_DICT = {
    "거실": "living room",
    "방": "room",
    "침실": "bedroom",
    "안방": "master bedroom",
    "주방": "kitchen",
    "부엌": "kitchen",
    "화장실": "bathroom",
    "욕실": "bathroom",
    "서재": "study room, home office",
    "베란다": "balcony",
    "발코니": "balcony",
    "밝고": "bright,",
    "밝은": "bright,",
    "화사한": "bright and sunny,",
    "미니멀한": "minimalist,",
    "심플한": "simple and clean,",
    "따뜻한": "warm,",
    "아늑한": "cozy and comfortable,",
    "세련된": "sophisticated, modern,",
    "고급스러운": "luxurious, premium,",
    "모던한": "modern,",
    "클래식한": "classic, elegant,",
    "하얀색": "white color scheme,",
    "화이트": "white tone,",
    "나무": "natural wood texture,",
    "우드": "wooden furniture,",
    "소파": "sofa, couch",
    "침대": "bed",
    "책상": "desk",
    "의자": "chair",
    "식탁": "dining table",
    "조명": "ambient lighting",
    "바꿔줘": "renovated design",
    "변경해줘": "redesigned interior"
}

def translate_korean_prompt(user_prompt: str) -> str:
    """한국어 입력이 포함된 경우 사전 매핑을 통해 영문 키워드로 치환 및 정리합니다."""
    if not user_prompt:
        return ""
    
    translated = user_prompt
    for kr, en in KOREAN_INTERIOR_DICT.items():
        translated = translated.replace(kr, en)
        
    translated_cleaned = re.sub(r"[ㄱ-ㅎㅏ-ㅣ가-힣]", "", translated).strip()
    return translated_cleaned if len(translated_cleaned) >= 2 else translated

def build_prompts(style: str, user_prompt: str) -> tuple[str, str]:
    """스타일과 사용자 입력을 합쳐 최종 Positive Prompt와 Negative Prompt를 생성합니다."""
    style_lower = (style or "modern").lower().strip()
    style_keyword = STYLE_MAPPINGS.get(style_lower, STYLE_MAPPINGS["modern"])
    
    translated_user = translate_korean_prompt(user_prompt or "")
    
    positive_parts = [
        "realistic interior design",
        style_keyword
    ]
    if translated_user:
        positive_parts.append(translated_user)
        
    positive_parts.extend([
        "high quality",
        "photorealistic",
        "detailed furniture",
        "natural light",
        "clean composition"
    ])
    
    positive_prompt = ", ".join(positive_parts)
    return positive_prompt, DEFAULT_NEGATIVE_PROMPT
