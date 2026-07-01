# 🚀 ZipPT Production 컨테이너 배포 가이드 (FastAPI + ComfyUI)

이 가이드는 로컬 개발 환경에서 사용하던 FastAPI 백엔드 앱과 로컬 ComfyUI AI 서버를 **Docker Compose를 이용해 단일 백엔드 서비스처럼 하나로 묶어 프로덕션 환경에 배포하는 방식**을 설명합니다.

---

## 🏛️ 아키텍처 개요

```
             ┌─────────────────────────┐
             │   클라이언트 (Streamlit) │
             └────────────┬────────────┘
                          │ HTTP (Port 8000)
                          ▼
        ┌───────────────────────────────────┐
        │        Docker Compose망           │
        │ ┌───────────────────────────────┐ │
        │ │     zippt-backend (FastAPI)   │ │
        │ └───────────────┬───────────────┘ │
        │                 │ HTTP (Port 8188)│
        │                 ▼                 │
        │ ┌───────────────────────────────┐ │
        │ │    zippt-comfyui (AI 서버)     │ │
        │ └───────────────────────────────┘ │
        └───────────────────────────────────┘
```

백엔드 웹앱 컨테이너와 ComfyUI 컨테이너가 가상의 동일 Docker 네트워크에 격리 결합되어 구동되며, 호스트 PC의 NVIDIA GPU 가속 엔진을 그대로 바인딩하여 딥러닝 렌더링을 태웁니다.

---

## 📋 배포 사전 요구사항

1. **Docker 및 Docker Compose**가 서버(혹은 배포 호스트 PC)에 설치되어 있어야 합니다.
2. **NVIDIA Container Toolkit**이 호스트 OS에 설치되어 있어야 컨테이너 내부에서 GPU 장치(`--gpus all`)를 활용할 수 있습니다.
3. `.env` 파일 내에 유효한 `GOOGLE_API_KEY`가 정의되어야 합니다.

---

## ⚙️ 실행 및 배포 명령어

모든 구성 파일(`Dockerfile.backend`, `docker-compose.yml`)이 위치한 프로젝트 디렉토리에서 아래 명령어를 순차 실행합니다.

### 1. 컨테이너 빌드 및 백그라운드 구동
```bash
docker-compose up -d --build
```
* `-d`: 백그라운드 백터 구동 (Daemon 모드)
* `--build`: 소스 코드 변경에 맞추어 백엔드 도커 이미지를 새로 빌드

### 2. 가동 상태 및 실시간 로그 모니터링
```bash
docker-compose ps
docker-compose logs -f --tail=50
```

### 3. 컨테이너 서비스 중지
```bash
docker-compose down
```

---

## 📦 AI 모델 가중치 파일 관리 가이드
* `docker-compose.yml` 내의 볼륨 마운트 설정을 보시면 호스트의 포터블 `models` 경로를 그대로 마운트하도록 매핑되어 있습니다.
* 클라우드 리눅스 서버에 배포 시에는 로컬 EFS 마운트 경로 또는 서버 내의 모델 보관 폴더 절대 경로로 볼륨 설정을 다음과 같이 수정해 주시면 됩니다.
  ```yaml
  volumes:
    - /var/ai_models:/home/user/ComfyUI/models
  ```
