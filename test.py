from PIL import Image
import torch
from torchvision import models, transforms
import time
device = torch.device("cpu")

image_path = input("이미지 파일 경로를 입력하세요: ")
# 2전처리
transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])
# 1모델로그
weights = models.ResNet18_Weights.DEFAULTs
model = models.resnet18(weights=weights)
# CPU로 이동
model = model.to(device)
model.eval()
# 이미지 로드
image = Image.open(image_path).convert("RGB")
input_tensor = transform(image).unsqueeze(0).to(device)
# 3추론
with torch.no_grad():
    output = model(input_tensor)
    start = time.time()
    output = model(input_tensor)
    end = time.time()
    print("실행 시간: ", end - start)
# 4결과 출력
pred = output.argmax(dim=1).item()
label = weights.meta["categories"][pred]
print(f"\n예측 결과: {label}")
print(f"실행 장치: {device}")