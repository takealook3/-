# 가구 탐지 및 정밀 Inpainting 워크플로우 사용 가이드

이 가이드는 생성된 `furniture_inpainting_workflow.json` 파일을 ComfyUI에서 실행하기 위한 커스텀 노드 설치 및 AI 모델 다운로드 경로를 안내합니다.

---

## 1. 필수 커스텀 노드 설치
ComfyUI 내의 `ComfyUI-Manager`를 통해 다음 두 패키지를 설치해야 합니다.

1.  **ComfyUI-Impact-Pack**
    *   역할: 객체 탐지 및 정밀 인페인팅 세그멘테이션(`SEGSDetailer`) 기능 지원
2.  **comfyui-segment-anything**
    *   역할: Segment Anything(SAM) 기능을 제공하여 의자, 소파 등 가구 영역의 정밀한 실루엣 마스크 획득

---

## 2. AI 모델 가중치 파일 다운로드 및 배치
워크플로우 실행을 위해 아래 모델 파일들이 해당 경로에 위치해야 합니다.

| 모델 구분 | 파일명 (예시) | 다운로드 후 배치 경로 |
| :--- | :--- | :--- |
| **YOLOv8 Detector** | `yolov8x-oiv7.pt` | `ComfyUI/models/ultralytics/bbox/` |
| **SAM Model** | `sam_vit_h_4b8939.pth` | `ComfyUI/models/sams/` |
| **Stable Diffusion** | `v1-5-pruned-emaonly.safetensors` | `ComfyUI/models/checkpoints/` |
| **ControlNet Inpaint** | `control_v11p_sd15_inpaint.safetensors` | `ComfyUI/models/controlnet/` |

> [!TIP]
> *   YOLOv8 OpenImage v7(oiv7) 모델은 의자(Chair), 소파(Couch), 테이블(Table), 침대(Bed) 등 다양한 실내 가구 카테고리를 사전 학습하여 본 워크플로우에 최적입니다.
> *   SAM 모델은 `vit_h` 또는 `vit_l` 버전을 권장합니다.

---

## 3. 핵심 노드 설정 매뉴얼

### ① BboxDetectorSEGS (가구 카테고리 필터링)
*   `detect_ids` 파라미터에 감지할 가구의 영어 클래스 이름을 쉼표로 나열합니다.
    *   예시: `chair, couch, bed, dining table`
*   YOLO가 Bounding Box를 찾으면 SAM 모델이 그 내부에서 가구의 실제 테두리만 오려내어 정밀한 마스크(`SEGS` 포맷)로 만듭니다.

### ② SEGSDetailer (페더링 및 왜곡 방지 영역)
*   **Feathering 설정 (`feather` 파라미터)**:
    *   기본값: `20`
    *   역할: 인페인팅이 적용된 가구 경계면을 원본 배경과 얼마나 자연스럽게 섞을지 결정하는 필터입니다. 값이 크면 경계선이 더 부드럽게 흐려져 원본 배경과 융합(Feathering)이 극대화되지만, 너무 크면 가구 주변 배경까지 침범할 수 있습니다.
*   **왜곡 방지**: `SEGSDetailer`는 마스크 영역만 크롭하여 인페인팅을 한 뒤 원본에 복원(Paste)하기 때문에 마스크로 선택되지 않은 주변 배경 이미지는 픽셀 단위로 완벽하게 보존됩니다.
*   **ControlNet 연동**: `control_net` 입력 핀에 인페인트 전용 ControlNet을 연결하여, AI가 새로운 스타일을 생성할 때 원본 가구의 구조(실루엣, 깊이 등)를 가이드로 삼아 무너지지 않도록 유도합니다.

---

## 4. 구동 순서
1. ComfyUI 웹 브라우저 화면에 [furniture_inpainting_workflow.json](file:///c:/study/Mini-Project/furniture_inpainting_workflow.json) 파일을 드래그앤드롭하여 로드합니다.
2. `LoadImage` 노드에 인페인팅 타겟 가구 이미지를 업로드합니다.
3. `CLIPTextEncode` (Positive) 노드에 생성하고 싶은 가구 스타일(예: `a modern luxury leather sofa`)을 기술합니다.
4. `Queue Prompt` 버튼을 눌러 실행합니다.
