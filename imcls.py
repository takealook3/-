import sys
import os

# 윈도우 터미널(CP949)에서 이모티콘 및 UTF-8 한글 문자 출력 오류를 방지하기 위한 설정
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from PIL import Image

# PyTorch 및 torchvision 라이브러리 불러오기
try:
    import torch
    from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights
except ImportError:
    print("❌ 오류: PyTorch 또는 torchvision 라이브러리가 설치되어 있지 않습니다.")
    print("💡 해결 방법: 콘다 환경에서 'pip install torch torchvision' 명령어로 설치해 주세요.")
    sys.exit(1)

def main():
    # 1. 사용자로부터 이미지 경로 입력받기
    # 터미널에서 스크립트 실행 시 이미지 경로를 함께 전달해야 합니다. (예: python imcls.py image.jpg)
    if len(sys.argv) < 2:
        print("💡 사용법: python imcls.py <이미지_파일_경로>")
        print("예시: python imcls.py Image202606271222 데모.jpg")
        sys.exit(1)

    image_path = sys.argv[1]

    # 2. 이미지 파일이 실제로 존재하는지 확인
    if not os.path.exists(image_path):
        print(f"❌ 오류: '{image_path}' 파일을 찾을 수 없습니다.")
        print("💡 해결 방법: 올바른 파일 경로를 입력했는지 확인해 주세요.")
        sys.exit(1)

    print(f"🔍 '[{image_path}]' 이미지를 분석하고 있습니다. 잠시만 기다려 주세요...")

    # 3. 사전 학습된 인공지능 모델(MobileNetV3) 불러오기
    # 마치 수많은 사진을 보고 공부를 마친 똑똑한 AI 감별사를 데려오는 것과 같습니다.
    # DEFAULT는 현재 이용 가능한 가장 최신/최고 성능의 학습 가중치(데이터)를 의미합니다.
    weights = MobileNet_V3_Small_Weights.DEFAULT
    model = mobilenet_v3_small(weights=weights)
    model.eval()  # 모델을 평가(추론) 모드로 설정합니다. (학습 모드 OFF)

    # 4. 이미지 전처리 도구 준비
    # AI 모델이 이해할 수 있도록 이미지 크기를 맞추고 색상 값을 조절(규격화)하는 과정입니다.
    preprocess = weights.transforms()

    # 5. 이미지 열기 및 전처리 적용
    try:
        img = Image.open(image_path).convert("RGB") # 3채널(RGB) 컬러 이미지로 변환
        img_transformed = preprocess(img).unsqueeze(0) # AI 모델에 넣기 위해 배치(묶음) 차원 추가
    except Exception as e:
        print(f"❌ 이미지 처리 중 오류 발생: {e}")
        sys.exit(1)

    # 6. AI 모델로 예측(추론) 수행
    with torch.no_grad(): # 예측할 때는 기울기 계산이 필요 없으므로 메모리 절약을 위해 꺼줍니다.
        output = model(img_transformed)
        
    # 7. 예측 결과 해석하기 (점수를 확률로 변환)
    probabilities = torch.nn.functional.softmax(output[0], dim=0) # 소프트맥스 함수로 0~100% 확률로 변환
    top5_prob, top5_catid = torch.topk(probabilities, 5) # 가장 확률이 높은 상위 5개를 뽑습니다.

    # 8. 클래스 이름 가져오기 (예: 'golden retriever')
    categories = weights.meta["categories"]

    # 9. 결과 출력
    print("\n🎉 === [ AI 이미지 분류 결과 ] ===")
    print("비유하자면, AI가 이 사진을 보고 가장 확신하는 정답 상위 5개입니다:\n")
    for i in range(5):
        category_name = categories[top5_catid[i]]
        prob = top5_prob[i].item() * 100
        print(f" {i+1}순위: {category_name} (확신도: {prob:.2f}%)")
    print("==================================\n")

if __name__ == "__main__":
    main()
