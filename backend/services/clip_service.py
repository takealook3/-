# -*- coding: utf-8 -*-
# backend/services/clip_service.py
# ─────────────────────────────────────────────────────────────────────────────
# 🎨 산디과 코딩 가이드 적용: CLIP 시각적 검색 엔진 서비스 모듈
# 비유: 인테리어 사진과 설명 글씨를 같은 "시각 미술실(동일 차원 벡터 공간)"에 
# 데려다 놓고 서로 얼마나 어울리는지 자로 재어 점수를 매기는 자(도구)입니다.
# ─────────────────────────────────────────────────────────────────────────────

import os
os.environ["HF_ENDPOINT"] = "https://huggingface.co"
import torch
import numpy as np
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

# ── CLIP 서비스 클래스 정의 (싱글톤 패턴으로 모델 중복 로드를 방지합니다) ──
class CLIPService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(CLIPService, cls).__new__(cls, *args, **kwargs)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        # 모델 정보: OpenAI에서 개발한 가장 가볍고 효율적인 clip-vit-base-patch32를 사용합니다.
        self.model_name = "openai/clip-vit-base-patch32"
        self.active_model_info = "None"
        print(f"📦 [CLIP Service] '{self.model_name}' 모델을 메모리에 불러오는 중입니다 (최초 실행 시 다운로드 진행)...")
        
        # CPU 환경에 최적화하여 로드합니다.
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.local_fallback = None
        
        try:
            self.model = CLIPModel.from_pretrained(self.model_name).to(self.device)
            self.processor = CLIPProcessor.from_pretrained(self.model_name)
            self.model.eval() # 평가 모드 활성화 (드롭아웃 등을 비활성화하여 일관된 임베딩 값 추출)
            self.active_model_info = "openai/clip-vit-base-patch32 (오리지널 CLIP)"
            print(f"✅ [CLIP Service] 모델 로드 완료 (사용 디바이스: {self.device})")
        except Exception as e:
            print(f"❌ [CLIP Service] 모델 로드 오류 발생 (오프라인/가상 모킹 모드로 자동 전환): {e}")
            self.model = None
            self.processor = None
            
            # 🎨 [초경량 가상/로컬 이미지 임베딩 대체기 탑재]
            try:
                print("📦 [CLIP Service] 대체 이미지 임베딩 모델(MobileNetV2) 로딩 시도...")
                self.local_fallback = self._load_local_fallback_model()
                if self.local_fallback:
                    self.active_model_info = "MobileNetV2 (로컬 폴백)"
            except Exception as le:
                print(f"⚠️ [CLIP Service] 대체 임베딩 모델 로드 실패: {le}")
                self.local_fallback = None
                
            if not self.local_fallback:
                self.active_model_info = "가상 임베딩 (L2 정규화 난수 벡터)"
            
        self._initialized = True

    def _load_local_fallback_model(self):
        import torch.nn as nn
        try:
            try:
                from torchvision.models import mobilenet_v2, MobileNet_V2_Weights
                backbone = mobilenet_v2(weights=MobileNet_V2_Weights.DEFAULT)
            except ImportError:
                from torchvision.models import mobilenet_v2
                backbone = mobilenet_v2(pretrained=True)
            print("🟢 [CLIP Service Fallback] Pretrained MobileNetV2 로드 완료")
        except Exception as e:
            print(f"🟡 [CLIP Service Fallback] Pretrained 가중치 다운로드 실패 ({e}). 초기화 상태로 로드합니다.")
            try:
                from torchvision.models import mobilenet_v2
                backbone = mobilenet_v2(weights=None)
            except:
                from torchvision.models import mobilenet_v2
                backbone = mobilenet_v2(pretrained=False)
                
        # 1280 -> 512 선형 결합 투영 레이어로 classifier 교체
        torch.manual_seed(42)
        backbone.classifier = nn.Sequential(
            nn.Dropout(p=0.2),
            nn.Linear(1280, 512)
        )
        backbone.to(self.device)
        backbone.eval()
        return backbone

    # ── [핵심 기능 1] 이미지 파일로부터 임베딩 벡터 추출하기 ──
    def get_image_embedding(self, image_path_or_pil):
        """
        이미지를 불러와 CLIP 모델이 이해할 수 있는 512차원 정규화 벡터로 변환합니다.
        - 인풋: 이미지 파일 경로(str) 또는 PIL Image 객체
        - 아웃풋: L2 정규화된 512차원 float 리스트
        """
        if not self.model or not self.processor:
            if self.local_fallback:
                try:
                    from torchvision.transforms import functional as F
                    print("🧠 [CLIP Service] get_image_embedding: 로컬 MobileNetV2 모델을 사용하여 512차원 임베딩을 실시간 추출합니다.")
                    if isinstance(image_path_or_pil, str):
                        if not os.path.exists(image_path_or_pil):
                            print(f"⚠️ [CLIP Service] 파일이 존재하지 않습니다: {image_path_or_pil}")
                            return None
                        image = Image.open(image_path_or_pil).convert("RGB")
                    else:
                        image = image_path_or_pil.convert("RGB")
                        
                    # 전처리 및 텐서 변환
                    img_resized = image.resize((224, 224))
                    tensor = F.to_tensor(img_resized).to(self.device)
                    tensor = tensor.unsqueeze(0)
                    tensor = F.normalize(tensor, mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
                    
                    with torch.no_grad():
                        features = self.local_fallback(tensor)
                        # L2 정규화 적용 (유사도 연산 대비)
                        features = features / features.norm(p=2, dim=-1, keepdim=True)
                        
                    return features.cpu().numpy()[0].tolist()
                except Exception as ex:
                    print(f"⚠️ [CLIP Service] 로컬 모델 임베딩 추출 에러: {ex}")
                    
            # 오프라인/다운로드 실패 환경 대응용 512차원 가상 임베딩 (L2 정규화 적용)
            print("⚠️ [CLIP Service] get_image_embedding: 모델 및 대체 모델 미기동 상태 - 512차원 가상 L2 정규화 난수 벡터를 반환합니다.")
            random_vector = np.random.randn(512)
            normalized_vector = (random_vector / np.linalg.norm(random_vector)).tolist()
            return normalized_vector

        try:
            if isinstance(image_path_or_pil, str):
                if not os.path.exists(image_path_or_pil):
                    print(f"⚠️ [CLIP Service] 파일이 존재하지 않습니다: {image_path_or_pil}")
                    return None
                image = Image.open(image_path_or_pil).convert("RGB")
            else:
                image = image_path_or_pil.convert("RGB")

            # 이미지를 전처리(크기 조절 및 정규화)한 후 PyTorch 텐서로 변환합니다.
            inputs = self.processor(images=image, return_tensors="pt").to(self.device)
            
            with torch.no_grad():
                # 이미지의 시각적 특징 정보를 뽑아냅니다.
                outputs = self.model.get_image_features(**inputs)
                
                # transformers 5.x 이상 버전에서는 출력이 BaseModelOutputWithPooling 객체이므로 pooler_output을 가져옵니다.
                if hasattr(outputs, "pooler_output"):
                    image_features = outputs.pooler_output
                else:
                    image_features = outputs
                    
                # 벡터의 크기를 1로 만드는 정규화(L2 Normalization)를 진행합니다. (코사인 유사도 비교를 위해 필수)
                image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
                
            return image_features.cpu().numpy()[0].tolist()
        except Exception as e:
            print(f"⚠️ [CLIP Service] 이미지 임베딩 추출 중 에러: {e}")
            return None

    # ── [핵심 기능 2] 텍스트 설명으로부터 임베딩 벡터 추출하기 ──
    def get_text_embedding(self, text_query):
        """
        텍스트 질문이나 가구 묘사로부터 CLIP 모델이 이해할 수 있는 512차원 정규화 벡터로 변환합니다.
        - 인풋: 텍스트 문장 (예: "a cozy white fabric sofa")
        - 아웃풋: L2 정규화된 512차원 float 리스트
        """
        if not self.model or not self.processor:
            # 오프라인/다운로드 실패 환경 대응용 512차원 가상 임베딩 (L2 정규화 적용)
            print("⚠️ [CLIP Service] get_text_embedding: 모델 미기동 상태 - 512차원 가상 L2 정규화 난수 벡터를 반환합니다.")
            random_vector = np.random.randn(512)
            normalized_vector = (random_vector / np.linalg.norm(random_vector)).tolist()
            return normalized_vector

        try:
            # 텍스트를 토큰화하여 전처리합니다.
            inputs = self.processor(text=text_query, return_tensors="pt", padding=True).to(self.device)
            
            with torch.no_grad():
                # 텍스트의 언어적 특징 정보를 뽑아냅니다.
                outputs = self.model.get_text_features(**inputs)
                
                # 동일하게 transformers 5.x 이상 객체형 포맷 대응
                if hasattr(outputs, "pooler_output"):
                    text_features = outputs.pooler_output
                else:
                    text_features = outputs
                    
                # 동일하게 L2 정규화를 진행합니다.
                text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)
                
            return text_features.cpu().numpy()[0].tolist()
        except Exception as e:
            print(f"⚠️ [CLIP Service] 텍스트 임베딩 추출 중 에러: {e}")
            return None

    # ── [유사도 계산기] 두 벡터 간의 유사도를 퍼센트 점수로 변환 ──
    @staticmethod
    def calculate_similarity(vector1, vector2):
        """
        L2 정규화된 두 임베딩 벡터의 내적(Dot Product)을 통해 코사인 유사도를 구합니다.
        - 아웃풋: -1.0 ~ 1.0 사이의 실수 (보통 CLIP 유사도는 0.15 ~ 0.45 범위에 몰려 있어, 가독성을 위해 조율할 수 있습니다)
        """
        if not vector1 or not vector2:
            return 0.0
        v1 = np.array(vector1)
        v2 = np.array(vector2)
        # 이미 크기가 1인 정규화 벡터이므로, 단순 곱의 합(내적)이 곧 코사인 유사도입니다.
        similarity = np.dot(v1, v2)
        return float(similarity)

    # ── 3가지 요구사항 구현부 ──

    # 1) 이미지 ➡️ 텍스트 매칭
    def search_image_to_text(self, image_path, text_candidates):
        """
        하나의 이미지와 여러 텍스트 후보들 간의 어울림 점수를 계산해 순위를 정합니다.
        - 예: 소파 이미지 입력 ➡️ ['sofa', 'chair', 'table'] 중 가장 어울리는 것 매치
        """
        img_emb = self.get_image_embedding(image_path)
        if not img_emb:
            return []

        results = []
        for text in text_candidates:
            txt_emb = self.get_text_embedding(text)
            if not txt_emb:
                continue
            sim = self.calculate_similarity(img_emb, txt_emb)
            results.append({"text": text, "similarity": sim})

        # 유사도가 높은 순으로 정렬합니다
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results

    # 2) 텍스트 ➡️ 이미지 매칭
    def search_text_to_image(self, text_query, image_paths):
        """
        텍스트 쿼리를 입력받아, 여러 이미지 데이터베이스 후보 중에서 가장 잘 매칭되는 사진들을 정렬합니다.
        - 예: '따뜻한 우드 식탁' 입력 ➡️ 관련된 이미지 사진 리스트 정렬
        """
        txt_emb = self.get_text_embedding(text_query)
        if not txt_emb:
            return []

        results = []
        for img_path in image_paths:
            if not os.path.exists(img_path):
                continue
            img_emb = self.get_image_embedding(img_path)
            if not img_emb:
                continue
            sim = self.calculate_similarity(txt_emb, img_emb)
            results.append({"image_path": img_path, "similarity": sim})

        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results

    # 3) 이미지 ➡️ 이미지 매칭 (핵심 유사 상품 추천)
    def search_image_to_image(self, target_image_path, database_image_paths):
        """
        사용자가 오려낸 이미지(Target)와 데이터베이스 내 후보 이미지들 간의 비주얼 유사도를 비교하여 정렬합니다.
        - 예: 크롭한 소파 사진 ➡️ DB에 저장된 다른 소파 사진들과의 순수 시각 유사도 추천
        """
        target_emb = self.get_image_embedding(target_image_path)
        if not target_emb:
            return []

        results = []
        for db_img_path in database_image_paths:
            if not os.path.exists(db_img_path):
                continue
            db_emb = self.get_image_embedding(db_img_path)
            if not db_emb:
                continue
            sim = self.calculate_similarity(target_emb, db_emb)
            results.append({"image_path": db_img_path, "similarity": sim})

        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results
