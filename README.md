# 🏠 AI 기반 2D 인테리어 이미지 수정 기술 가이드북

이 가이드북은 `.safetensors` 파일을 활용하여 **인테리어 스타일을 변경(Img2Img)**하고, **특정 영역을 수정(Inpainting)**하는 기술의 개념과 파이썬 구현 방법을 설명합니다.

---

## 💡 핵심 기술 개념 이해하기

### 1. `.safetensors` 파일이란?
* **정의**: AI가 이미지의 스타일과 형태를 그릴 때 참조하는 **"가중치(Weight) 데이터셋"**입니다.
* **보안성**: 예전에는 파이썬 코드 실행 위험이 있던 `.ckpt` 포맷을 썼으나, 현재는 안전하고 빠른 오픈 포맷인 `.safetensors`를 사용합니다.
* **역할**: Civitai 같은 사이트에서 인테리어 전문 모델을 다운로드받아 적용하면, 인테리어 디자인에 최적화된 가구와 조명을 훌륭하게 그려낼 수 있습니다.

### 2. 스타일 변경: Image-to-Image (Img2Img)
* **어떻게 작동하나요?**
  1. 원본 이미지(기존 방 사진)를 준비합니다.
  2. AI에게 원본 이미지의 구조를 어느 정도 유지할지 강도(`strength`)를 조절하여 전달합니다.
  3. 프롬프트(텍스트 설명)에 "Modern luxury living room, high quality" 등을 주면 원본의 틀 위에서 새로운 스타일로 이미지를 덧그립니다.

### 3. 부분 수정: 인페인팅 (Inpainting)
* **어떻게 작동하나요?**
  1. 원본 이미지에서 수정하고 싶은 특정 가구나 구역을 흑백 이미지인 **"마스크(Mask)"**로 만듭니다. (수정할 부분은 흰색, 유지할 부분은 검은색)
  2. 이름 뒤에 `-inpainting`이 들어간 특화 모델을 불러옵니다.
  3. AI에게 원본 이미지, 마스크 이미지, 그리고 "바꾸고 싶은 가구 이름"을 입력하면, 마스크 영역만 감쪽같이 새로 그립니다.

---

## 🛠️ 개발 환경 설정하기

이 기술을 파이썬으로 구현하기 위해서는 아래 라이브러리들이 필요합니다. 터미널(PowerShell 등)을 열고 아래 명령어를 실행하여 라이브러리를 설치하세요.

```bash
# PyTorch 설치 (CUDA가 지원되는 GPU 환경이 권장됩니다)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# Hugging Face의 이미지 생성 라이브러리 및 필수 도구 설치
pip install diffusers transformers accelerate safetensors
```

---

## 📂 모델 준비하기
1. [Civitai](https://civitai.com/) 등에서 원하는 스타일의 `.safetensors` 모델을 다운로드합니다.
   * **일반 스타일 변환용**: 예) `Realistic_Vision_V5.1_Hyper_pruned.safetensors`
   * **인페인팅(부분 수정)용**: 예) `Realistic_Vision_V5.1-inpainting.safetensors`
2. 프로젝트 디렉토리에 `models/` 폴더를 생성하고 다운로드받은 파일을 넣어줍니다.

다음 파일 [sd_tutorial.py](file:///c:/STUDY/2dTO2d/sd_tutorial.py)를 열어 실제 파이썬 구현 코드를 확인해 보세요!
