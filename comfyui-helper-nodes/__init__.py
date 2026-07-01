# ComfyUI용 커스텀 노드 초기화 파일
# 이 파일을 통해 ComfyUI가 로드 시 커스텀 노드 클래스를 탐색하고 등록합니다.

from .image_nodes import ImageContrastBrightness, ImageTextOverlay

# ComfyUI 내부에서 사용할 노드 클래스 매핑
NODE_CLASS_MAPPINGS = {
    "ImageContrastBrightness": ImageContrastBrightness,
    "ImageTextOverlay": ImageTextOverlay
}

# ComfyUI UI 상에서 노드를 검색하거나 표시할 때 사용할 노드 이름 매핑
NODE_DISPLAY_NAME_MAPPINGS = {
    "ImageContrastBrightness": "Image Contrast & Brightness (Antigravity)",
    "ImageTextOverlay": "Image Text Overlay (Antigravity)"
}

# 다른 모듈에서 임포트 가능하도록 공개 키 설정
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']
