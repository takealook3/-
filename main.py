import sys
import io
import os
import base64

# 윈도우 터미널(CP949)에서 출력 오류(UnicodeEncodeError)를 방지하기 위한 안전 설정
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='cp949', errors='replace')
    except Exception:
        pass
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from dotenv import load_dotenv
try:
    from PIL import Image
    import numpy as np
    import torch
    from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights
    from ultralytics import YOLO
    HEAVY_AI_AVAILABLE = True
except ImportError:
    HEAVY_AI_AVAILABLE = False
    print("[안내] 가벼운 실행 모드: 무거운 AI 이미지 감별사 도구가 없어, 연애 모의고사 훈련소 모드로만 구동합니다.")

# 환경변수 로딩 및 구글 AI SDK 준비
load_dotenv()
try:
    from google import genai
    from google.genai import types
    GEMINI_CLIENT = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
except Exception as e:
    print(f"[경고] Gemini 클라이언트 초기화 실패: {e}")
    GEMINI_CLIENT = None

from rag_engine import RAGEngine

# AI 모델과 전처리 도구를 전역 변수로 보관할 딕셔너리
ml_models = {}
rag_engine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    if HEAVY_AI_AVAILABLE:
        # [서버가 켜질 때 실행되는 코드]
        print("[서버 시작] AI 이미지 분류 모델을 불러오는 중입니다...")
        weights = MobileNet_V3_Small_Weights.DEFAULT
        model = mobilenet_v3_small(weights=weights)
        model.eval()
        
        ml_models["model"] = model
        ml_models["preprocess"] = weights.transforms()
        ml_models["categories"] = weights.meta["categories"]
        print("[완료] 이미지 분류 AI 감별사가 출근하여 대기 중입니다!")
        
        print("[서버 시작] YOLOv8 객체 탐지 모델(yolov8n)을 불러오는 중입니다...")
        ml_models["yolo"] = YOLO("yolov8n.pt")
        print("[완료] 객체 탐지 AI 탐정도 출근하여 대기 중입니다!")
        
        print("[서버 시작] YOLOv8 포즈 추정 모델(yolov8n-pose)을 불러오는 중입니다...")
        ml_models["pose"] = YOLO("yolov8n-pose.pt")
        print("[완료] 관절 탐지 AI 화가도 출근하여 대기 중입니다!")
    else:
        print("[서버 시작] 가벼운 연애 모의고사 & RAG 훈련소 전용 모드로 빠르게 시작합니다!")
    
    # [RAG 사서 선생님 채용 및 소설책 분석 시작]
    global rag_engine
    print("[서버 시작] RAG 소설 사서 선생님(RAGEngine)을 출근시키고 소설책(<운수 좋은 날>) 분석을 시작합니다...")
    rag_engine = RAGEngine(client=GEMINI_CLIENT)
    rag_engine.initialize()
    
    # [InsightFace 얼굴 인식 및 유사도 분석 모델 로드]
    # 비유하자면, 사람 얼굴의 관상을 512개의 특징으로 분석해 내는 관상 감별사를 고용하는 것입니다.
    print("[서버 시작] InsightFace 얼굴 인식 모델(buffalo_l)을 불러오는 중입니다...")
    try:
        from insightface.app import FaceAnalysis
        face_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        face_app.prepare(ctx_id=0, det_size=(640, 640))
        ml_models["face_app"] = face_app
        print("[완료] 얼굴 인식 AI 관상 감별사도 출근하여 대기 중입니다!")
    except Exception as e:
        print(f"[경고] InsightFace 로드 중 오류 발생: {e}")
    
    # [EasyOCR 광학 문자 인식 모델 로드]
    # 비유하자면, 사진 속에 적힌 글자(한글/영어)를 빠르고 정확하게 타자로 쳐 주는 AI 속기사를 출근시키는 것입니다.
    print("[서버 시작] EasyOCR 글자 판독 모델(ko, en)을 불러오는 중입니다...")
    try:
        import easyocr
        # gpu=False로 설정하여 일반 PC에서도 메모리 부담 없이 가볍게 구동되도록 합니다.
        ml_models["ocr"] = easyocr.Reader(['ko', 'en'], gpu=False)
        print("[완료] OCR 글자 판독 AI 속기사도 출근하여 대기 중입니다!")
    except Exception as e:
        print(f"[경고] EasyOCR 로드 중 오류 발생 (터미널에서 패키지 설치 필요): {e}")
    
    yield
    # [서버가 꺼질 때 실행되는 코드]
    ml_models.clear()
    print("[서버 종료] 모든 AI 감별사가 퇴근했습니다.")

# FastAPI 애플리케이션 생성 (lifespan 적용)
app = FastAPI(
    title="AI 이미지 분류 API",
    description="이미지를 업로드하면 MobileNetV3 모델이 무엇인지 분석해 주는 API입니다.",
    version="1.0.0",
    lifespan=lifespan
)

# 정적 파일(CSS, JS 등)을 제공할 static 폴더 연결 (비유: 쇼룸 인테리어 소품 창고 개방)
app.mount("/static", StaticFiles(directory="static"), name="static")

# HTML 템플릿을 제공할 템플릿 엔진 설정 (비유: 쇼룸 전시관 안내 카탈로그 준비)
templates = Jinja2Templates(directory="templates")

@app.get("/")
def read_root(request: Request):
    """사용자가 브라우저로 접속했을 때 AI 감별 쇼룸 웹 페이지(index.html)를 보여줍니다."""
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/game")
def read_game(request: Request):
    """사용자가 '/game'으로 접속했을 때 가위바위보 미니게임 오락실(game.html)을 보여줍니다."""
    return templates.TemplateResponse(request=request, name="game.html")

@app.get("/card")
def read_card(request: Request):
    """사용자가 '/card'로 접속했을 때 카드 짝 맞추기 미니게임 오락실(card.html)을 보여줍니다."""
    return templates.TemplateResponse(request=request, name="card.html")

@app.get("/survivor")
def read_survivor(request: Request):
    """사용자가 '/survivor'로 접속했을 때 뱀파이어 서바이벌 미니게임 오락실(survivor.html)을 보여줍니다."""
    return templates.TemplateResponse(request=request, name="survivor.html")

@app.get("/detector")
def read_detector(request: Request):
    """사용자가 '/detector'로 접속했을 때 AI 객체 탐지 시각화 전용 쇼룸(detector.html)을 보여줍니다."""
    return templates.TemplateResponse(request=request, name="detector.html")

@app.get("/pose")
def read_pose(request: Request):
    """사용자가 '/pose'로 접속했을 때 AI 포즈 추정 쇼룸(pose.html)을 보여줍니다."""
    return templates.TemplateResponse(request=request, name="pose.html")

@app.get("/face")
def read_face(request: Request):
    """사용자가 '/face'로 접속했을 때 AI 얼굴 유사도 감정소(face.html)를 보여줍니다."""
    return templates.TemplateResponse(request=request, name="face.html")

@app.get("/studio")
def read_studio(request: Request):
    """사용자가 '/studio'로 접속했을 때 4대 비전 AI 통합 올인원 스튜디오(studio.html)를 보여줍니다."""
    return templates.TemplateResponse(request=request, name="studio.html")

@app.get("/demo_multi_apis")
def read_demo_multi(request: Request):
    """사용자가 '/demo_multi_apis'로 접속했을 때 조건부 스마트 다중 API 파이프라인 페이지를 보여줍니다."""
    return templates.TemplateResponse(request=request, name="demo_multi.html")

@app.get("/ocr")
def read_ocr(request: Request):
    """사용자가 '/ocr'로 접속했을 때 AI 광학 문자 인식(OCR) 쇼룸(ocr.html)을 보여줍니다."""
    return templates.TemplateResponse(request=request, name="ocr.html")

@app.post("/predict")
async def predict_image(file: UploadFile = File(...)):
    """
    사용자가 업로드한 이미지 파일을 받아 AI가 분석한 상위 5개 결과를 반환합니다.
    """
    # 1. 업로드된 파일이 이미지인지 확인합니다.
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="❌ 오류: 이미지 파일(jpg, png 등)만 업로드 가능합니다.")

    try:
        # 2. 업로드된 파일 데이터를 바이트 형태로 읽어옵니다.
        image_bytes = await file.read()
        
        # 3. 바이트 데이터를 PIL 이미지 객체로 변환하고 3채널(RGB) 컬러로 맞춥니다.
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # 4. 출근해 있는 AI 감별사의 전처리 도구로 이미지 크기와 색상을 맞춥니다.
        preprocess = ml_models["preprocess"]
        img_transformed = preprocess(img).unsqueeze(0)
        
        # 5. AI 모델로 예측(추론)을 수행합니다.
        model = ml_models["model"]
        with torch.no_grad():
            output = model(img_transformed)
            
        # 6. 예측 점수를 0~100% 확률(소프트맥스)로 변환하고 상위 5개를 추출합니다.
        probabilities = torch.nn.functional.softmax(output[0], dim=0)
        top5_prob, top5_catid = torch.topk(probabilities, 5)
        
        categories = ml_models["categories"]
        
        # 7. 결과를 보기 좋은 목록(JSON 데이터)으로 정리합니다.
        predictions = []
        for i in range(5):
            cat_name = categories[top5_catid[i]]
            prob = round(top5_prob[i].item() * 100, 2)
            predictions.append({
                "rank": i + 1,
                "category": cat_name,
                "probability": f"{prob}%"
            })
            
        return {
            "filename": file.filename,
            "status": "success",
            "predictions": predictions
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"❌ 이미지 분석 중 오류가 발생했습니다: {str(e)}")

@app.post("/detect")
async def detect_object(file: UploadFile = File(...)):
    """
    사용자가 업로드한 이미지 파일에서 물체(객체)들을 탐지하여 클래스 이름과 바운딩 박스(bbox) 좌표를 반환합니다.
    비유하자면, 사진 속 물체들의 위치에 네모 박스를 치고 각각 무엇인지 표찰을 붙여주는 감별 서비스입니다.
    """
    # 1. 업로드된 파일이 이미지인지 확인합니다.
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="❌ 오류: 이미지 파일(jpg, png 등)만 업로드 가능합니다.")

    try:
        # 2. 업로드된 파일 데이터를 바이트 형태로 읽어옵니다.
        image_bytes = await file.read()
        
        # 3. 바이트 데이터를 PIL 이미지 객체로 변환하고 3채널(RGB) 컬러로 맞춥니다.
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # 4. 출근해 있는 YOLOv8 객체 탐지 탐정 모델을 가져옵니다.
        yolo_model = ml_models["yolo"]
        
        # 5. 객체 탐지 수행 (비유: 사진 속에서 물체들에 네모 박스 치기)
        # 그래픽카드(GPU) CUDA 호환성 오류 발생 시, 안전하고 확실한 CPU 모드로 자동 전환합니다.
        try:
            results = yolo_model(img)
        except Exception:
            results = yolo_model(img, device='cpu')
        
        # 6. 탐지된 물체들의 정보를 정리할 리스트 준비
        detections = []
        
        # 첫 번째 이미지에 대한 탐지 결과(boxes)를 반복하며 정보 추출
        for box in results[0].boxes:
            # 바운딩 박스 좌표 [x1, y1, x2, y2] (소수점 둘째 자리 반올림)
            # x1, y1: 좌측 상단 꼭지점 좌표 / x2, y2: 우측 하단 꼭지점 좌표
            coords = [round(c, 2) for c in box.xyxy[0].tolist()]
            
            # 확신도(확률) 계산 (0~1 사이 값을 100분율로 변환)
            conf = round(box.conf[0].item() * 100, 2)
            
            # 탐지된 클래스 ID 번호 및 이름 가져오기 (예: 0 -> 'person')
            cls_id = int(box.cls[0].item())
            cls_name = yolo_model.names[cls_id]
            
            detections.append({
                "class": cls_name,
                "confidence": f"{conf}%",
                "bbox": {
                    "x1": coords[0],
                    "y1": coords[1],
                    "x2": coords[2],
                    "y2": coords[3]
                }
            })
            
        # 7. 네모 박스가 그려진 시각화 이미지를 Base64 문자열로 변환합니다.
        plotted_det_array = results[0].plot()[..., ::-1]
        plotted_det_img = Image.fromarray(plotted_det_array)
        buffer_det = io.BytesIO()
        plotted_det_img.save(buffer_det, format="JPEG")
        encoded_det_img = base64.b64encode(buffer_det.getvalue()).decode("utf-8")
        detect_image_base64 = f"data:image/jpeg;base64,{encoded_det_img}"
            
        return {
            "filename": file.filename,
            "status": "success",
            "total_detected": len(detections),
            "detections": detections,
            "detect_image_base64": detect_image_base64
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"❌ 객체 탐지 중 오류가 발생했습니다: {str(e)}")

@app.post("/pose")
async def estimate_pose(file: UploadFile = File(...)):
    """
    사용자가 업로드한 이미지 파일에서 사람을 찾아 17개 관절 좌표(JSON)와 뼈대가 그려진 사진(Base64)을 동시 반환합니다.
    비유하자면, 사진 속 사람들의 뼈대에 스티커를 붙이고 관절 위치 명세서까지 함께 작성해 주는 서비스입니다.
    """
    # 1. 업로드된 파일이 이미지인지 확인합니다.
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="❌ 오류: 이미지 파일(jpg, png 등)만 업로드 가능합니다.")

    try:
        # 2. 업로드된 파일 데이터를 바이트 형태로 읽어옵니다.
        image_bytes = await file.read()
        
        # 3. 바이트 데이터를 PIL 이미지 객체로 변환하고 3채널(RGB) 컬러로 맞춥니다.
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # 4. 출근해 있는 YOLOv8 포즈 추정 화가 모델을 가져옵니다.
        pose_model = ml_models["pose"]
        
        # 5. 포즈 추정 수행 (비유: 사진 속 사람 관절 찾고 뼈대 그리기)
        # 그래픽카드(GPU) 오류가 발생할 경우를 대비해 안전한 CPU 모드로 자동 전환합니다.
        try:
            results = pose_model(img)
        except Exception:
            results = pose_model(img, device='cpu')
        
        result = results[0]  # 첫 번째 이미지의 분석 결과
        
        # 6. 관절 이름 17개 정의 (초보자도 쉽게 알아볼 수 있도록 친절하게 한글 이름 부여)
        keypoint_names = [
            "코(Nose)", "왼쪽 눈(Left Eye)", "오른쪽 눈(Right Eye)",
            "왼쪽 귀(Left Ear)", "오른쪽 귀(Right Ear)",
            "왼쪽 어깨(Left Shoulder)", "오른쪽 어깨(Right Shoulder)",
            "왼쪽 팔꿈치(Left Elbow)", "오른쪽 팔꿈치(Right Elbow)",
            "왼쪽 손목(Left Wrist)", "오른쪽 손목(Right Wrist)",
            "왼쪽 골반(Left Hip)", "오른쪽 골반(Right Hip)",
            "왼쪽 무릎(Left Knee)", "오른쪽 무릎(Right Knee)",
            "왼쪽 발목(Left Ankle)", "오른쪽 발목(Right Ankle)"
        ]
        
        persons_data = []
        
        # 탐지된 사람(관절 정보)이 있는지 확인합니다.
        if result.keypoints is not None and len(result.keypoints) > 0:
            # 사람들의 관절 좌표 데이터(xy)와 신뢰도(conf)를 파이썬 리스트로 변환
            xy_data = result.keypoints.xy.cpu().numpy()
            conf_data = result.keypoints.conf.cpu().numpy() if result.keypoints.conf is not None else None
            
            # 탐지된 사람 수만큼 반복
            for idx in range(len(xy_data)):
                person_keypoints = []
                for kp_idx in range(17):
                    x, y = round(float(xy_data[idx][kp_idx][0]), 2), round(float(xy_data[idx][kp_idx][1]), 2)
                    conf = round(float(conf_data[idx][kp_idx]) * 100, 2) if conf_data is not None else 100.0
                    
                    # 좌표가 (0, 0)이면 화면에 안 보이는 관절이므로 판별
                    is_visible = not (x == 0.0 and y == 0.0)
                    
                    person_keypoints.append({
                        "id": kp_idx,
                        "name": keypoint_names[kp_idx],
                        "x": x,
                        "y": y,
                        "confidence": f"{conf}%",
                        "visible": is_visible
                    })
                
                persons_data.append({
                    "person_index": idx + 1,
                    "keypoints": person_keypoints
                })
        
        # 7. 뼈대가 그려진 시각화 이미지를 Base64 문자열로 변환합니다.
        # result.plot()은 BGR 배열을 반환하므로 RGB 형태로 뒤집어서 PIL 이미지로 만듭니다.
        plotted_img_array = result.plot()[..., ::-1]
        plotted_img = Image.fromarray(plotted_img_array)
        
        # 메모리 버퍼에 JPEG 형식으로 저장
        buffer = io.BytesIO()
        plotted_img.save(buffer, format="JPEG")
        encoded_img = base64.b64encode(buffer.getvalue()).decode("utf-8")
        base64_data_url = f"data:image/jpeg;base64,{encoded_img}"
        
        # 8. 최종 결과 반환 (JSON 좌표 + Base64 이미지)
        return {
            "filename": file.filename,
            "status": "success",
            "total_persons_detected": len(persons_data),
            "persons": persons_data,
            "pose_image_base64": base64_data_url
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"❌ 포즈 추정 중 오류가 발생했습니다: {str(e)}")

@app.post("/analyze_face_similarity")
async def analyze_face_similarity(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    """
    두 개의 이미지 파일(file1, file2)을 받아 YOLOv8로 인물 영역을 검증하고,
    InsightFace로 얼굴 특징점을 추출하여 코사인 유사도(%)와 동일인 여부를 판정합니다.
    비유하자면, 두 사람의 관상을 정밀 비교하여 얼마나 닮았는지 감정해 주는 창구입니다.
    """
    if not file1.content_type.startswith("image/") or not file2.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="❌ 오류: 두 파일 모두 이미지 파일이어야 합니다.")
        
    try:
        bytes1 = await file1.read()
        bytes2 = await file2.read()
        
        img1_pil = Image.open(io.BytesIO(bytes1)).convert("RGB")
        img2_pil = Image.open(io.BytesIO(bytes2)).convert("RGB")
        
        # 1. YOLOv8로 사진 속 인물/물체 검출 (참고 정보 제공)
        yolo_model = ml_models.get("yolo")
        yolo_det1 = len(yolo_model(img1_pil, device='cpu')[0].boxes) if yolo_model else 0
        yolo_det2 = len(yolo_model(img2_pil, device='cpu')[0].boxes) if yolo_model else 0
        
        # 2. InsightFace는 OpenCV BGR 배열(numpy)을 입력으로 받으므로 RGB -> BGR 변환
        img1_bgr = np.array(img1_pil)[:, :, ::-1]
        img2_bgr = np.array(img2_pil)[:, :, ::-1]
        
        face_app = ml_models.get("face_app")
        if not face_app:
            raise HTTPException(status_code=500, detail="❌ InsightFace 얼굴 인식 모델이 준비되지 않았습니다.")
            
        faces1 = face_app.get(img1_bgr)
        faces2 = face_app.get(img2_bgr)
        
        if len(faces1) == 0:
            return {"status": "fail", "message": f"❌ 첫 번째 사진({file1.filename})에서 얼굴을 찾지 못했습니다."}
        if len(faces2) == 0:
            return {"status": "fail", "message": f"❌ 두 번째 사진({file2.filename})에서 얼굴을 찾지 못했습니다."}
            
        # 가장 큰 얼굴(보통 첫 번째 검출 결과) 선택
        emb1 = faces1[0].normed_embedding
        emb2 = faces2[0].normed_embedding
        
        # 코사인 유사도 계산 (정규화된 벡터의 내적)
        cosine_sim = float(np.dot(emb1, emb2))
        
        # 0~1 사이 비율로 매핑하여 직관적인 백분율(%) 산출
        # 얼굴 인식에서 코사인 유사도 0.42 이상이면 동일인으로 판단합니다.
        similarity_pct = round(max(0.0, min(1.0, (cosine_sim + 0.2) / 1.2)) * 100, 2)
        is_same = cosine_sim >= 0.42
        
        return {
            "status": "success",
            "file1_name": file1.filename,
            "file2_name": file2.filename,
            "yolo_objects_detected": [yolo_det1, yolo_det2],
            "faces_count": [len(faces1), len(faces2)],
            "raw_similarity": round(cosine_sim, 4),
            "similarity_percentage": f"{similarity_pct}%",
            "is_same_person": is_same,
            "verdict": "🎉 동일 인물(또는 매우 닮은 가족)로 판정되었습니다!" if is_same else "🤔 서로 다른 인물로 판정되었습니다."
        }
    except Exception as e:
        # 예외 발생 시 500 에러와 함께 원인을 반환합니다.
        raise HTTPException(status_code=500, detail=f"❌ 얼굴 유사도 분석 중 오류가 발생했습니다: {str(e)}")

@app.post("/api/multi_demo")
async def run_multi_demo(file: UploadFile = File(...)):
    """
    단일 이미지를 업로드받아 스마트 파이프라인으로 분석합니다.
    1. 이미지 분류 및 객체 탐지를 먼저 수행하여 사람('person')의 존재 유무와 수를 파악합니다.
    2. 사람이 없으면(0명) 객체 탐지 및 분류 시각화 결과만 반환합니다.
    3. 사람이 1명 이상 있으면 포즈 추정(자세 인식)까지 수행합니다.
    4. 사람이 여러 명(2명 이상)이면 감지된 얼굴들 간의 얼굴 유사도 비교까지 수행하여 반환합니다.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="❌ 이미지 파일만 업로드 가능합니다.")

    try:
        image_bytes = await file.read()
        img_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_bgr = np.array(img_pil)[:, :, ::-1] # InsightFace 및 OpenCV용 BGR 배열

        # [단계 1] 이미지 분류 수행 (비유: AI 감별사에게 사진을 보여주고 무엇인지 물어봄)
        cls_model = ml_models.get("model")  # 서버 시작 시 'model' 키로 저장된 MobileNetV3 모델을 불러옵니다.
        categories = ml_models.get("categories", [])
        img_tensor = ml_models["preprocess"](img_pil).unsqueeze(0)
        with torch.no_grad():
            output = cls_model(img_tensor)
        probs = torch.nn.functional.softmax(output[0], dim=0)
        top5_prob, top5_catid = torch.topk(probs, 5)
        classification_list = []
        for i in range(5):
            classification_list.append({
                "rank": i + 1,
                "category": categories[top5_catid[i]],
                "probability": f"{round(top5_prob[i].item() * 100, 2)}%"
            })

        # [단계 2] 객체 탐지 수행 및 사람 수 카운트
        yolo_model = ml_models.get("yolo")
        try:
            det_results = yolo_model(img_pil)
        except Exception:
            det_results = yolo_model(img_pil, device='cpu')

        detections = []
        person_count = 0
        for box in det_results[0].boxes:
            coords = [round(c, 2) for c in box.xyxy[0].tolist()]
            conf = round(box.conf[0].item() * 100, 2)
            cls_id = int(box.cls[0].item())
            cls_name = yolo_model.names[cls_id]
            if cls_name == "person":
                person_count += 1
            detections.append({
                "class": cls_name,
                "confidence": f"{conf}%",
                "bbox": {"x1": coords[0], "y1": coords[1], "x2": coords[2], "y2": coords[3]}
            })

        plotted_det_array = det_results[0].plot()[..., ::-1]
        buf_det = io.BytesIO()
        Image.fromarray(plotted_det_array).save(buf_det, format="JPEG")
        detect_image_base64 = f"data:image/jpeg;base64,{base64.b64encode(buf_det.getvalue()).decode('utf-8')}"

        # -------------------------------------------------------------
        # 조건부 분기 1: 사람이 없는 경우 (person_count == 0)
        # -------------------------------------------------------------
        if person_count == 0:
            return {
                "status": "success",
                "step": "no_person",
                "person_count": 0,
                "message": "🚫 사진에서 사람이 감지되지 않았습니다! [이미지 분류]와 [객체 탐지] 결과만 스마트하게 시각화합니다.",
                "classification": classification_list,
                "detection": {
                    "total_detected": len(detections),
                    "list": detections,
                    "image_base64": detect_image_base64
                }
            }

        # -------------------------------------------------------------
        # 조건부 분기 2: 사람이 1명 이상 있는 경우 -> 포즈 추정 수행
        # -------------------------------------------------------------
        pose_model = ml_models.get("pose")
        try:
            pose_results = pose_model(img_pil)
        except Exception:
            pose_results = pose_model(img_pil, device='cpu')

        plotted_pose_array = pose_results[0].plot()[..., ::-1]
        buf_pose = io.BytesIO()
        Image.fromarray(plotted_pose_array).save(buf_pose, format="JPEG")
        pose_image_base64 = f"data:image/jpeg;base64,{base64.b64encode(buf_pose.getvalue()).decode('utf-8')}"

        pose_data = {
            "total_persons_detected": len(pose_results[0].keypoints) if pose_results[0].keypoints is not None else 0,
            "image_base64": pose_image_base64
        }

        if person_count == 1:
            return {
                "status": "success",
                "step": "single_person",
                "person_count": 1,
                "message": "👤 1명의 사람이 감지되었습니다! [객체 탐지]와 사람 전용 [자세 인식(포즈 스캔)] 결과를 함께 시각화합니다.",
                "classification": classification_list,
                "detection": {
                    "total_detected": len(detections),
                    "list": detections,
                    "image_base64": detect_image_base64
                },
                "pose": pose_data
            }

        # -------------------------------------------------------------
        # 조건부 분기 3: 사람이 여러 명(2명 이상) 있는 경우 -> 얼굴 인식 및 비교 수행
        # -------------------------------------------------------------
        face_app = ml_models.get("face_app")
        faces = face_app.get(img_bgr) if face_app else []

        if len(faces) < 2:
            return {
                "status": "success",
                "step": "multi_person_no_faces",
                "person_count": person_count,
                "message": f"👥 {person_count}명의 사람이 감지되어 [자세 인식]을 완료했습니다! (단, 정면 얼굴이 2개 이상 명확히 인식되지 않아 얼굴 비교는 생략되었습니다)",
                "classification": classification_list,
                "detection": {
                    "total_detected": len(detections),
                    "list": detections,
                    "image_base64": detect_image_base64
                },
                "pose": pose_data
            }

        # 얼굴 바운딩 박스가 그려진 시각화 이미지 생성
        res_bgr = face_app.draw_on(img_bgr.copy(), faces)
        buf_face = io.BytesIO()
        Image.fromarray(res_bgr[:, :, ::-1]).save(buf_face, format="JPEG")
        face_image_base64 = f"data:image/jpeg;base64,{base64.b64encode(buf_face.getvalue()).decode('utf-8')}"

        # 첫 번째 얼굴과 두 번째 얼굴의 코사인 유사도 계산
        emb1 = faces[0].normed_embedding
        emb2 = faces[1].normed_embedding
        cosine_sim = float(np.dot(emb1, emb2))
        similarity_pct = round(max(0.0, min(1.0, (cosine_sim + 0.2) / 1.2)) * 100, 2)
        is_same = cosine_sim >= 0.42

        return {
            "status": "success",
            "step": "multi_person_with_faces",
            "person_count": person_count,
            "message": f"🔥 훌륭합니다! {person_count}명의 사람이 감지되었습니다. [객체 탐지], [자세 인식]뿐만 아니라 감지된 얼굴({len(faces)}개) 간의 [얼굴 유사도 비교]까지 모든 비전 API를 총동원하여 시각화합니다!",
            "classification": classification_list,
            "detection": {
                "total_detected": len(detections),
                "list": detections,
                "image_base64": detect_image_base64
            },
            "pose": pose_data,
            "face_similarity": {
                "faces_count": len(faces),
                "similarity_percentage": f"{similarity_pct}%",
                "is_same_person": is_same,
                "verdict": "🎉 첫 번째와 두 번째 얼굴이 매우 닮은 쌍둥이/동일인 수준입니다!" if is_same else "🤔 감지된 인물들은 서로 개성이 다른 얼굴입니다.",
                "image_base64": face_image_base64
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"❌ 파이프라인 분석 중 오류가 발생했습니다: {str(e)}")

@app.post("/api/ocr")
async def run_ocr_api(file: UploadFile = File(...)):
    """
    업로드된 이미지에서 EasyOCR을 이용하여 한글 및 영어 텍스트를 추출하고,
    글자가 발견된 위치에 바운딩 박스를 그린 시각화 이미지와 텍스트 목록을 반환합니다.
    비유하자면, 문서나 간판 사진을 주면 AI 속기사가 글자 위치에 형광펜을 칠하고 내용을 받아적어 주는 창구입니다.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="❌ 이미지 파일만 업로드 가능합니다.")
        
    ocr_reader = ml_models.get("ocr")
    if not ocr_reader:
        raise HTTPException(status_code=500, detail="❌ EasyOCR 모델이 로드되지 않았습니다. 터미널에서 'conda run -n venv pip install easyocr' 명령어를 실행하여 패키지를 설치해 주세요.")
        
    try:
        from PIL import ImageDraw
        image_bytes = await file.read()
        img_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_bgr = np.array(img_pil)[:, :, ::-1] # EasyOCR 및 OpenCV용 BGR 배열
        
        # EasyOCR로 텍스트 탐지 수행 (결과: [[bbox, text, prob], ...])
        results = ocr_reader.readtext(img_bgr)
        
        # 글자 위치에 바운딩 박스 그리기
        draw = ImageDraw.Draw(img_pil)
        extracted_items = []
        
        for idx, (bbox, text, prob) in enumerate(results):
            p1, p2, p3, p4 = bbox
            # 다각형 형광 네온 테두리 그리기
            draw.polygon([tuple(p1), tuple(p2), tuple(p3), tuple(p4)], outline=(0, 240, 255), width=3)
            extracted_items.append({
                "id": idx + 1,
                "text": text,
                "confidence": f"{round(prob * 100, 1)}%"
            })
            
        # 시각화된 이미지 Base64 인코딩
        buf = io.BytesIO()
        img_pil.save(buf, format="JPEG")
        ocr_image_base64 = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"
        
        return {
            "status": "success",
            "total_detected": len(extracted_items),
            "image_base64": ocr_image_base64,
            "items": extracted_items,
            "message": f"✨ 성공적으로 {len(extracted_items)}개의 텍스트 영역을 발견하고 판독했습니다!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"❌ OCR 글자 추출 중 오류가 발생했습니다: {str(e)}")


# ==============================================================================
# [연애 모의고사] 여친의 곤란한 질문 답변 시뮬레이터 API 및 라우터
# ==============================================================================

class EvaluateRequest(BaseModel):
    question: str
    user_answer: str

@app.get("/answer-practice")
def read_answer_practice(request: Request):
    """사용자가 '/answer-practice'로 접속했을 때 연애 모의고사 훈련소 페이지(answer_practice.html)를 보여줍니다."""
    return templates.TemplateResponse(request=request, name="answer_practice.html")

@app.post("/api/generate-question")
def generate_question():
    """
    Gemini AI(출제 위원)를 호출하여 여자친구가 남자친구에게 던질 법한 
    아주 곤란하고 난감한 질문을 랜덤으로 1개 생성하여 반환합니다.
    """
    if not GEMINI_CLIENT:
        raise HTTPException(status_code=500, detail="Gemini API가 연결되지 않았습니다. .env 파일의 API 키를 확인해주세요.")
    
    prompt = (
        "너는 남자친구를 당황하게 만드는 연애 고수 여자친구야. "
        "남자친구가 답변하기 정말 곤란하고 미묘한 질문(예: '나 오늘 뭐 달라진 거 없어?', '전여친이 예뻐 내가 예뻐?', "
        "'나 일하다가 우울해서 화분 샀어', '게임이 중요해 내가 중요해?', '나 살찐 거 같지 않냐고') 중 하나를 랜덤으로 새롭게 만들어줘. "
        "딱 질문 한 문장만 출력해. 부연 설명이나 따옴표 없이 질문 내용만 출력해."
    )
    
    try:
        response = GEMINI_CLIENT.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        question_text = response.text.strip().replace('"', '').replace("'", "")
        return {"status": "success", "question": question_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"질문 생성 중 오류 발생: {str(e)}")

@app.post("/api/evaluate-answer")
def evaluate_answer(req: EvaluateRequest):
    """
    Gemini AI(연애 코치)를 호출하여 질문과 사용자의 답변을 분석하고,
    100점 만점의 점수와 코칭 가이드, 모범 답안을 반환합니다.
    """
    if not GEMINI_CLIENT:
        raise HTTPException(status_code=500, detail="Gemini API가 연결되지 않았습니다.")
        
    prompt = f"""
너는 대한민국 최고의 연애 전문 심리 상담가이자 연애 코치야.
아래 여자친구의 곤란한 질문에 대한 남자친구(사용자)의 답변을 냉정하고 날카롭되, 재미있고 따뜻하게 평가해줘.

[여자친구의 질문]: {req.question}
[남자친구의 답변]: {req.user_answer}

다음 4가지 항목을 반드시 포함해서 답변해줘:
1. **점수**: 100점 만점 기준으로 몇 점인지 (숫자만 쓰지 말고 이유와 함께 명확히 표기, 예: 85점)
2. **여자의 속마음 (의도)**: 이 질문을 던진 여자의 진짜 심리와 원하는 대답이 무엇인지
3. **답변 평가 (피드백)**: 사용자의 답변에서 좋았던 점과 아쉬웠던 점 (위험 요소)
4. **모범 답안 추천**: 센스 있고 사랑받을 수 있는 100점짜리 추천 대사 2가지

초보자도 이해하기 쉽게 비유를 섞어서 재치 있게 설명해줘. 보기 좋게 마크다운 문법으로 줄바꿈을 잘 활용해서 작성해줘.
"""
    try:
        response = GEMINI_CLIENT.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return {"status": "success", "evaluation": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"답변 평가 중 오류 발생: {str(e)}")


# ==============================================================================
# RAG(검색 증강 생성) 소설 질의응답 웹 페이지 및 API
# ==============================================================================

@app.get("/rag")
def get_rag_page(request: Request):
    """
    RAG 연습 및 테스트를 위한 웹 페이지를 반환합니다.
    """
    # RAG 웹 페이지 템플릿 반환 (FastAPI 최신 규격에 맞게 request와 name 인자 명시)
    return templates.TemplateResponse(request=request, name="rag.html")

class RAGQueryRequest(BaseModel):
    query: str

@app.post("/api/rag-query")
def api_rag_query(req: RAGQueryRequest):
    """
    사용자의 질문을 받아 RAGEngine 사서에게 전달하고, 
    소설책에서 찾은 관련 구절과 Gemini의 답변을 반환합니다.
    """
    if not rag_engine or not rag_engine.is_ready:
        raise HTTPException(status_code=500, detail="RAG 사서 시스템이 아직 준비되지 않았거나 로딩 중입니다.")
    return rag_engine.generate_answer(req.query)


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*65)
    print("🚀 [웹 서버 시작] 아래 원하시는 주소로 접속하세요!")
    print("💘 연애 모의고사: http://127.0.0.1:8000/answer-practice")
    print("📚 RAG 소설 검색: http://127.0.0.1:8000/rag")
    print("="*65 + "\n")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
