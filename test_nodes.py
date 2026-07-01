import numpy as np
import sys
import os
import warnings

# NumPy 2.0+ 버전의 __array_wrap__ 등 하위 호환성 경고 무시
warnings.filterwarnings("ignore", category=DeprecationWarning)

# PyTorch가 설치되어 있지 않은 환경을 위한 모킹(Mock) 모듈 주입
try:
    import torch
except ImportError:
    print("[정보] 로컬 환경에 PyTorch가 없어 모킹(Mock) 모듈을 활성화합니다.")
    import types
    
    class MockTensor:
        def __init__(self, data):
            self.data = np.array(data, dtype=np.float32)
            self.shape = self.data.shape
            
        def __getitem__(self, idx):
            return MockTensor(self.data[idx])
            
        def cpu(self):
            return self
            
        def numpy(self):
            return self.data
            
        def __mul__(self, other):
            return MockTensor(self.data * other)
            
        def __add__(self, other):
            return MockTensor(self.data + other)
            
        def mean(self):
            return MockTensor(self.data.mean())
            
        def item(self):
            return float(self.data)

    mock_torch = types.ModuleType("torch")
    mock_torch.clamp = lambda tensor, min_val, max_val: MockTensor(np.clip(tensor.data, min_val, max_val))
    mock_torch.ones = lambda shape, dtype=None: MockTensor(np.ones(shape, dtype=np.float32))
    mock_torch.from_numpy = lambda array: MockTensor(array)
    mock_torch.stack = lambda tensors, dim=0: MockTensor(np.stack([t.data for t in tensors], axis=dim))
    mock_torch.float32 = np.float32
    
    # sys.modules에 주입하여 라이브러리가 있는 것처럼 속임
    sys.modules["torch"] = mock_torch
    import torch

# 패키지를 임포트하기 위해 comfyui-helper-nodes 디렉터리를 sys.path에 추가
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "comfyui-helper-nodes"))

from image_nodes import ImageContrastBrightness, ImageTextOverlay

def main():
    print("=== ComfyUI 커스텀 노드 단위 테스트 실행 ===")
    
    # 1. 가상 이미지 텐서 생성 [B, H, W, C] -> [1, 256, 256, 3] (회색 배경)
    dummy_image = torch.ones((1, 256, 256, 3), dtype=torch.float32) * 0.5
    print(f"입력 이미지 텐서 셰이프: {dummy_image.shape}")
    
    # 2. ImageContrastBrightness 노드 테스트
    print("\n[테스트 1] ImageContrastBrightness 작동 테스트")
    contrast_node = ImageContrastBrightness()
    # contrast = 1.2, brightness = 0.1 적용
    result_cb = contrast_node.adjust(dummy_image, contrast=1.2, brightness=0.1)
    output_image_cb = result_cb[0]
    print(f"밝기/대비 조절 후 셰이프: {output_image_cb.shape}")
    
    # 예상 연산값 검증: (0.5 * 1.2) + 0.1 = 0.7
    mean_val = output_image_cb.mean().item()
    print(f"결과 픽셀 평균 값 (기대값: 0.7): {mean_val:.4f}")
    assert abs(mean_val - 0.7) < 1e-5, "밝기/대비 연산 오차 발생!"
    print("-> ImageContrastBrightness 테스트 성공")

    # 3. ImageTextOverlay 노드 테스트
    print("\n[테스트 2] ImageTextOverlay 작동 테스트")
    text_node = ImageTextOverlay()
    result_text = text_node.draw_text(
        image=dummy_image,
        text="Test Run\n한글 테스트",
        font_size=24,
        x_position=20,
        y_position=20,
        font_color_hex="#FF0000"
    )
    output_image_text = result_text[0]
    print(f"텍스트 합성 후 셰이프: {output_image_text.shape}")
    
    # 텍스트 합성 후 텐서의 픽셀 값에 변화가 생겼는지 검증
    # MockTensor는 연산자 오버로딩 또는 data를 비교해야 하므로 래핑을 풂
    dummy_data = dummy_image.data if hasattr(dummy_image, 'data') else dummy_image.cpu().numpy()
    output_data = output_image_text.data if hasattr(output_image_text, 'data') else output_image_text.cpu().numpy()
    pixel_diff = np.abs(output_data - dummy_data).sum()
    
    print(f"텍스트 합성 전후 픽셀 변화량: {pixel_diff:.4f}")
    assert pixel_diff > 0, "텍스트 합성 노드가 픽셀을 변경하지 못했습니다!"
    print("-> ImageTextOverlay 테스트 성공")
    
    print("\n모든 커스텀 노드가 표준 규격에 맞게 성공적으로 동작했습니다.")

if __name__ == "__main__":
    main()
