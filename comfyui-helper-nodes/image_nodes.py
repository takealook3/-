import torch
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os
import platform

class ImageContrastBrightness:
    """
    이미지의 대비(Contrast)와 밝기(Brightness)를 조절하는 노드
    """
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        # 입력 핀 및 매개변수 설정
        return {
            "required": {
                "image": ("IMAGE",),
                "contrast": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 3.0, "step": 0.01}),
                "brightness": ("FLOAT", {"default": 0.0, "min": -1.0, "max": 1.0, "step": 0.01}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "adjust"
    CATEGORY = "Antigravity/ImageProcessing"

    def adjust(self, image, contrast, brightness):
        # ComfyUI 이미지 텐서: [B, H, W, C], 값 범위 0.0 ~ 1.0
        # 밝기 및 대비 조절 수식: (pixel * contrast) + brightness
        adjusted = image * contrast + brightness
        # 값을 0.0 ~ 1.0 범위로 클램핑하여 오버플로우 방지
        adjusted = torch.clamp(adjusted, 0.0, 1.0)
        return (adjusted,)


class ImageTextOverlay:
    """
    이미지 위에 한글/영문 텍스트를 합성하는 노드
    """
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        # 입력 핀 및 매개변수 설정
        return {
            "required": {
                "image": ("IMAGE",),
                "text": ("STRING", {"multiline": True, "default": "Hello ComfyUI\n안녕 컴피UI"}),
                "font_size": ("INT", {"default": 32, "min": 10, "max": 200, "step": 1}),
                "x_position": ("INT", {"default": 50, "min": 0, "max": 4096, "step": 1}),
                "y_position": ("INT", {"default": 50, "min": 0, "max": 4096, "step": 1}),
                "font_color_hex": ("STRING", {"default": "#FFFFFF"}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "draw_text"
    CATEGORY = "Antigravity/ImageProcessing"

    def draw_text(self, image, text, font_size, x_position, y_position, font_color_hex):
        # HEX 색상 포맷 검증 및 예외 처리
        color_hex = font_color_hex.strip()
        if not color_hex.startswith("#"):
            color_hex = "#" + color_hex
        if len(color_hex) not in (4, 7, 9):
            color_hex = "#FFFFFF"

        # 폰트 탐색 및 로딩 (OS별 한글/영문 폰트 대응)
        font_path = None
        system_name = platform.system()
        if system_name == "Windows":
            possible_fonts = [
                "C:\\Windows\\Fonts\\malgun.ttf",  # 맑은 고딕
                "C:\\Windows\\Fonts\\gulim.ttc",   # 굴림
                "C:\\Windows\\Fonts\\arial.ttf"    # Arial
            ]
        elif system_name == "Darwin":  # macOS
            possible_fonts = [
                "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
                "/Library/Fonts/Arial Unicode.ttf",
                "/System/Library/Fonts/Helvetica.ttc"
            ]
        else:  # Linux 및 기타
            possible_fonts = [
                "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
                "/usr/share/fonts/nanumfont/NanumGothic.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/freefont/FreeSans.ttf"
            ]

        for path in possible_fonts:
            if os.path.exists(path):
                font_path = path
                break

        # 폰트 로드 시도, 실패 시 기본 폰트로 폴백 (Pillow 10+ 사이즈 인자 고려)
        try:
            if font_path:
                font = ImageFont.truetype(font_path, font_size)
            else:
                try:
                    font = ImageFont.load_default(size=font_size)
                except TypeError:
                    font = ImageFont.load_default()
        except Exception:
            try:
                font = ImageFont.load_default(size=font_size)
            except TypeError:
                font = ImageFont.load_default()

        output_images = []

        # 배치 이미지 차례대로 처리 [B, H, W, C]
        for i in range(image.shape[0]):
            img_tensor = image[i]
            
            # PyTorch 텐서 -> NumPy 배열 -> PIL 이미지 변환
            img_np = (img_tensor.cpu().numpy() * 255).astype(np.uint8)
            pil_img = Image.fromarray(img_np)
            
            # PIL ImageDraw를 이용해 텍스트 쓰기
            draw = ImageDraw.Draw(pil_img)
            draw.text((x_position, y_position), text, fill=color_hex, font=font)
            
            # PIL 이미지 -> PyTorch 텐서 변환 (0.0 ~ 1.0 범위) 및 채널 수 유지
            out_np = np.array(pil_img).astype(np.float32) / 255.0
            if len(out_np.shape) == 2:  # H, W 형태일 경우 채널 차원 추가 [H, W, 1]
                out_np = np.expand_dims(out_np, axis=-1)
            out_tensor = torch.from_numpy(out_np)
            output_images.append(out_tensor)

        # 개별 텐서들을 배치 단위로 재결합 [B, H, W, C]
        output_tensor = torch.stack(output_images, dim=0)
        return (output_tensor,)
