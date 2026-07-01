# ComfyUI Helper Nodes (Antigravity)

ComfyUI에서 사용할 수 있는 이미지 후처리용 커스텀 노드 패키지입니다. 
ComfyUI 내부 이미지 포맷인 PyTorch Tensor(`[B, H, W, C]`)를 직접 제어하거나 PIL로 변환하여 처리하는 모범 사례를 포함하고 있습니다.

## 제공 노드 목록

### 1. Image Contrast & Brightness (Antigravity)
*   **카테고리**: `Antigravity/ImageProcessing`
*   **설명**: PyTorch Tensor의 고속 텐서 연산을 활용하여 이미지의 밝기(Brightness)와 대비(Contrast)를 조절합니다.
*   **파라미터**:
    *   `image`: 처리할 이미지 입력
    *   `contrast` (기본값: 1.0): 1.0보다 크면 대비 증가, 작으면 대비 감소
    *   `brightness` (기본값: 0.0): 양수이면 밝아지고, 음수이면 어두워짐

### 2. Image Text Overlay (Antigravity)
*   **카테고리**: `Antigravity/ImageProcessing`
*   **설명**: PIL(Pillow) 라이브러리를 활용해 이미지 위에 원하는 텍스트(한글/영문)를 합성합니다.
*   **파라미터**:
    *   `image`: 처리할 이미지 입력
    *   `text` (기본값: "Hello ComfyUI\n안녕 컴피UI"): 이미지 위에 그릴 문자열 (줄바꿈 지원)
    *   `font_size` (기본값: 32): 텍스트 크기 설정
    *   `x_position` / `y_position` (기본값: 50): 텍스트가 시작될 절대 좌표 (px)
    *   `font_color_hex` (기본값: "#FFFFFF"): 텍스트 색상 HEX 코드

---

## 설치 및 적용 방법

1. `comfyui-helper-nodes` 폴더 전체를 복사하여 귀하의 ComfyUI 설치 경로 내 `custom_nodes` 디렉터리에 붙여넣습니다.
   *   경로 예시: `C:\path\to\ComfyUI\custom_nodes\comfyui-helper-nodes`
2. ComfyUI를 실행 중이었다면 재시작합니다.
3. 빈 캔버스에서 마우스 우클릭 -> `Add Node` -> `Antigravity` 메뉴에서 노드를 추가할 수 있습니다.

## 의존성 요구사항
이 노드들은 ComfyUI가 기본으로 제공하는 라이브러리를 사용하므로 추가적인 특수 종속성 설치가 필요하지 않습니다.
*   `torch`
*   `numpy`
*   `pillow` (PIL)
