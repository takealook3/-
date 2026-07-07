import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import numpy as np

model_name = "openai/clip-vit-base-patch32"
model = CLIPModel.from_pretrained(model_name)
processor = CLIPProcessor.from_pretrained(model_name)

# 임의의 이미지 생성
img = Image.fromarray(np.uint8(np.random.rand(224, 224, 3) * 255))
inputs = processor(images=img, return_tensors="pt")

print("--- Image Feature Extraction ---")
with torch.no_grad():
    img_feats = model.get_image_features(**inputs)
    print("Type of img_feats:", type(img_feats))
    print("Attributes of img_feats:", dir(img_feats))
    
print("--- Text Feature Extraction ---")
inputs_txt = processor(text="a photo of a chair", return_tensors="pt")
with torch.no_grad():
    txt_feats = model.get_text_features(**inputs_txt)
    print("Type of txt_feats:", type(txt_feats))
