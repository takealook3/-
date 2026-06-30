# AI 종합 감별 전시관 및 미니게임 오락실 제품 요구사항 정의서 (PRD)

## 1. 프로젝트 개요
- **프로젝트명**: ANTIGRAVITY AI VISION SHOWROOM
- **목적**: 최신 비전 AI 모델(MobileNetV3, YOLOv8, InsightFace)을 웹 브라우저에서 누구나 쉽고 재미있게 체험할 수 있는 인터랙티브 웹 쇼룸 및 미니게임 플랫폼 구축

## 2. 주요 기능 명세

### ① AI 이미지 분류 (Image Classification)
- **사용 모델**: MobileNetV3 Small (PyTorch)
- **엔드포인트**: `/predict`
- **기능**: 사진 업로드 시 상위 5개 판독 결과 및 확률(%) 제공

### ② AI 객체 탐지 (Object Detection)
- **사용 모델**: YOLOv8n (Ultralytics)
- **엔드포인트**: `/detect`
- **기능**: 이미지 속 다수 물체의 위치 바운딩 박스(BBox) 표시 및 클래스 네온 칩 렌더링

### ③ AI 포즈 추정 (Pose Estimation)
- **사용 모델**: YOLOv8n-Pose
- **엔드포인트**: `/pose`
- **기능**: 인물의 17개 관절 좌표 인식, 디지털 뼈대 이미지 시각화 및 관절 검진표 제공

### ④ AI 얼굴 유사도 분석 (Face Similarity Analysis)
- **사용 모델**: YOLOv8n + InsightFace (`buffalo_l`)
- **엔드포인트**: `/analyze_face_similarity`
- **기능**: 2장의 인물 사진 업로드 시 512차원 임베딩 추출, 코사인 유사도(%) 계산 및 동일인 판정 게이지 애니메이션

### ⑤ 인터랙티브 미니게임 오락실
- **가위바위보**: `/game`
- **카드 짝 맞추기**: `/card`
- **뱀파이어 서바이벌**: `/survivor`

### ⑥ 올인원 종합 AI 스튜디오 (All-in-One AI Studio)
- **엔드포인트**: `/studio`
- **기능**: 이미지 분류, 객체 탐지, 포즈 추정, 얼굴 유사도 분석 4대 비전 AI를 한 페이지에서 새로고침 없이 동시 분석 및 탭 전환으로 체험할 수 있는 통합 대시보드

### ⑦ 스마트 다중 API 조건부 파이프라인 (Smart Multi-API Pipeline)
- **엔드포인트**: `/demo_multi_apis` (API: `/api/multi_demo`)
- **기능**: 단 1장의 업로드된 이미지를 대상으로 사람(person)의 존재 유무 및 인원수에 따라 필요한 비전 API를 조건부로 연쇄 구동하여 시각화하는 스마트 대시보드
  - **사람 없음 (0명)**: 이미지 분류(MobileNetV3) + 객체 탐지(YOLOv8) 시각화 결과 제공
  - **사람 1명 감지**: 이미지 분류 + 객체 탐지 + 자세 인식(17개 관절 포즈 추정) 시각화 제공
  - **사람 여러 명(2명 이상) 감지**: 이미지 분류 + 객체 탐지 + 자세 인식 + 얼굴 유사도 비교(InsightFace 코사인 유사도) 시각화 제공
  - **결과 다운로드**: AI가 시각화한 결과 이미지(객체 탐지, 자세 인식, 얼굴 유사도)를 원클릭으로 순차 다운로드하는 기능 지원

## 3. 기술 스택
- **Backend**: Python 3.12, FastAPI, Uvicorn, PyTorch, Torchvision, Ultralytics, InsightFace, ONNXRuntime
- **Frontend**: HTML5, Vanilla CSS (Glassmorphism & Neon Glow Aesthetics), JavaScript (ES6+)
- **Environment**: Conda (`venv`)
