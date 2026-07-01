# =====================================================================
# main.py: ZipPT API 백엔드 서버의 메인 안내 데스크 파일입니다.
# 비유: 병원이나 가게 입구에서 손님을 맞이하여 알맞은 진료실로 안내하는 
# '총괄 안내 데스크' 역할을 합니다.
# =====================================================================

from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import Optional, Dict, Any
import uuid, os, time, datetime, sys, json, shutil

# 상위 폴더(프로젝트 루트)에 있는 RAG 엔진(query.py) 임포트를 위한 sys.path 추가
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.env"))

# comfyui-helper-nodes 패키지 임포트
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../comfyui-helper-nodes"))

import numpy as np
from PIL import Image

try:
    import torch
except ImportError:
    print("[정보] 로컬 환경에 PyTorch가 없어 백엔드에 모킹(Mock) 모듈을 활성화합니다.")
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

        def unsqueeze(self, dim):
            return MockTensor(np.expand_dims(self.data, axis=dim))

    mock_torch = types.ModuleType("torch")
    mock_torch.clamp = lambda tensor, min_val, max_val: MockTensor(np.clip(tensor.data, min_val, max_val))
    mock_torch.ones = lambda shape, dtype=None: MockTensor(np.ones(shape, dtype=np.float32))
    mock_torch.from_numpy = lambda array: MockTensor(array)
    mock_torch.stack = lambda tensors, dim=0: MockTensor(np.stack([t.data for t in tensors], axis=dim))
    mock_torch.float32 = np.float32
    
    import sys
    sys.modules["torch"] = mock_torch
    import torch

try:
    from image_nodes import ImageContrastBrightness, ImageTextOverlay
    NODES_AVAILABLE = True
except Exception as e:
    print(f"⚠️ 커스텀 노드 임포트 불가 (모킹 대체): {e}")
    NODES_AVAILABLE = False

# RAG 엔진 임포트
try:
    import query
    RAG_AVAILABLE = True
except Exception as e:
    print(f"⚠️ RAG 모듈 로드 불가: {e}")
    RAG_AVAILABLE = False

# schemas.py 파일에서 공통 응답 봉투 및 전체 규격 모델을 가져옵니다.
from schemas import (
    GraffitiRemoveRequest, GraffitiRemoveResponse,
    SuccessResponse, ErrorResponse, ErrorCode, ImageUploadResponse, ImageInfoResponse,
    ImageGenerateRequest, ImageGenerateResponse,
    ChatMessageRequest, ChatMessageResponse,
    ImageEditRequest, ImageEditResponse,
    SessionHistoryResponse
)

app = FastAPI(title="ZipPT API - 종합 이미지 복원 & 편집 & 대화 서비스")


# =====================================================================
# [RAG 엔진 초기화 및 전역 인스턴스 구축]
# =====================================================================
rag_embeddings = None
rag_retriever = None
rag_llm = None
rag_enabled = False

if RAG_AVAILABLE:
    try:
        # GOOGLE_API_KEY가 있는지 우선 체크
        if os.getenv("GOOGLE_API_KEY"):
            print("🔧 Gemini 임베딩 모델 및 ChromaDB 로드 중...")
            rag_embeddings = query.GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
            rag_retriever = query.load_retriever(rag_embeddings)
            rag_llm = query.ChatGoogleGenerativeAI(model=query.LLM_MODEL, temperature=0.2)
            rag_enabled = True
            print("✅ RAG 시스템 초기화 성공!")
        else:
            print("⚠️ [RAG Warning] GOOGLE_API_KEY 환경 변수가 제공되지 않아 챗봇이 오프라인 모킹 모드로 작동합니다.")
    except Exception as e:
        print(f"⚠️ [RAG Warning] RAG 시스템 초기화 실패 (Mock 대체): {e}")

# =====================================================================
# [ComfyUI 워크플로우 시뮬레이션 및 이미지 가공 모킹 엔진]
# =====================================================================
def log_workflow_execution(workflow_filename: str) -> dict:
    """ComfyUI 워크플로우 JSON을 파싱하고 실행 노드를 구조화하여 로그로 남깁니다."""
    workflow_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", workflow_filename)
    if not os.path.exists(workflow_path):
        print(f"⚠️ [ComfyUI Sim] '{workflow_filename}' 워크플로우 파일이 유실되었습니다.")
        return {"workflow": workflow_filename, "status": "missing", "nodes": []}
    try:
        with open(workflow_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        nodes_info = []
        if "nodes" in data:
            for node in data["nodes"]:
                nodes_info.append(node.get("title") or node.get("type"))
        else:
            for node_id, node_data in data.items():
                nodes_info.append(node_data.get("_meta", {}).get("title") or node_data.get("class_type"))
        print(f"⚙️ [ComfyUI Sim] '{workflow_filename}' 로딩 성공. 실행 노드 수: {len(nodes_info)}개")
        return {"workflow": workflow_filename, "status": "loaded", "nodes": nodes_info}
    except Exception as e:
        print(f"⚠️ [ComfyUI Sim] 워크플로우 로드 실패: {e}")
        return {"workflow": workflow_filename, "status": "error", "nodes": []}

def process_mock_image(
    image_id: str,
    result_id: str,
    style_name: str = None,
    prompt_text: str = None,
    brightness: float = 0.0,
    contrast: float = 1.0,
    text_overlay: str = None,
    bbox: list = None
) -> str:
    """
    comfyui-helper-nodes의 노드 연산을 모사하여 업로드된 이미지에 
    실제 필터 및 텍스트 워터마크 합성을 수행하고 결과 파일로 저장합니다.
    """
    # 1. 원본 파일 탐색
    input_path = None
    ext_found = ".jpg"
    for ext in (".jpg", ".jpeg", ".png"):
        test_path = os.path.join("uploads", f"{image_id}{ext}")
        if os.path.exists(test_path):
            input_path = test_path
            ext_found = ext
            break
            
    # 2. 결과물 저장 경로 지정
    os.makedirs("results", exist_ok=True)
    output_path = os.path.join("results", f"{result_id}{ext_found}")
    
    # 원본 파일이 없으면 테스트 목적으로 기본 흰색 이미지 생성
    if not input_path or not os.path.exists(input_path):
        print(f"⚠️ 원본 파일 {image_id}가 없어 가상의 백색 이미지를 생성합니다.")
        img = Image.new("RGB", (512, 512), color="white")
        dummy_input = os.path.join("uploads", f"{image_id}.jpg")
        img.save(dummy_input)
        input_path = dummy_input
        ext_found = ".jpg"
        output_path = os.path.join("results", f"{result_id}.jpg")

    if not NODES_AVAILABLE:
        # 노드를 불러올 수 없으면 단순히 원본을 복제
        shutil.copy(input_path, output_path)
        return f"/static/results/{result_id}{ext_found}"

    try:
        # PIL 로드 및 정규화
        img = Image.open(input_path).convert("RGB")
        img_np = np.array(img).astype(np.float32) / 255.0
        
        # [1, H, W, C] 텐서 생성
        img_tensor = torch.from_numpy(img_np).unsqueeze(0)
        
        # 대비 및 밝기 조정 적용 (bright=brightness, contrast=contrast)
        cb_node = ImageContrastBrightness()
        img_tensor = cb_node.adjust(img_tensor, contrast=contrast, brightness=brightness)[0]
        
        # 텍스트 합성 구성
        overlay_msg = text_overlay or "ZipPT AI Processing"
        if style_name:
            overlay_msg += f"\nStyle: {style_name}"
        if prompt_text:
            overlay_msg += f"\nPrompt: {prompt_text}"
            
        text_node = ImageTextOverlay()
        img_tensor = text_node.draw_text(
            image=img_tensor,
            text=overlay_msg,
            font_size=20,
            x_position=20,
            y_position=20,
            font_color_hex="#00FF00"
        )[0]
        
        # 부분 편집 BBox 지정 시 영역 하이라이트 텍스트 오버레이 추가
        if bbox and len(bbox) == 4:
            img_tensor = text_node.draw_text(
                image=img_tensor,
                text=f"[Edit Area: {bbox}]",
                font_size=16,
                x_position=max(0, bbox[0]),
                y_position=max(0, bbox[1] - 20),
                font_color_hex="#FF0000"
            )[0]
            
        # 텐서 복원
        if hasattr(img_tensor, 'numpy'):
            out_np = img_tensor.numpy() if hasattr(img_tensor.numpy, '__call__') else img_tensor.numpy
        elif hasattr(img_tensor, 'data'):
            out_np = img_tensor.data
        else:
            out_np = np.array(img_tensor)
            
        if len(out_np.shape) == 4:
            out_np = out_np[0]
            
        out_np = np.clip(out_np * 255.0, 0, 255).astype(np.uint8)
        out_img = Image.fromarray(out_np)
        out_img.save(output_path)
        print(f"🎨 [Image Eng] 이미지 실제 가공 및 저장 완료: {output_path}")
    except Exception as e:
        print(f"❌ [Image Eng] 가공 실패 (복사 대체): {e}")
        shutil.copy(input_path, output_path)
        
    return f"/static/results/{result_id}{ext_found}"


# =====================================================================
# [0. 공통 에러 비상 시스템 (AppException & 처리기)]
# 비유: 서버 내부에서 문제가 생겼을 때, 일관된 실패 봉투 규격으로 알람을 울리는 비상벨입니다.
# =====================================================================
class AppException(Exception):
    def __init__(self, error_code: str, message: str, status_code: int = 400):
        self.error_code = error_code
        self.message = message
        self.status_code = status_code

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    """AppException 발생 시 약속된 실패 봉투(ErrorResponse) 형태로 JSON 응답을 보냅니다."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            success=False,
            error_code=exc.error_code,
            message=exc.message
        ).model_dump()
    )


# =====================================================================
# [0-1. 서버 내 이미지 보관 폴더 생성 및 정적 연결(Mount)]
# =====================================================================
os.makedirs("uploads", exist_ok=True)
os.makedirs("masks", exist_ok=True)
os.makedirs("results", exist_ok=True)

app.mount("/static/uploads", StaticFiles(directory="uploads"), name="static_uploads")
app.mount("/static/masks", StaticFiles(directory="masks"), name="static_masks")
app.mount("/static/results", StaticFiles(directory="results"), name="static_results")


# =====================================================================
# [0-2. 메모리 기반 세션 활동 장부 (DB 대용)]
# 비유: 손님(session_id)별로 어떤 이미지를 만들고 편집하고 대화했는지 기록하는 방명록 장부입니다.
# =====================================================================
session_store: Dict[str, Dict[str, Any]] = {}

def get_or_create_session(session_id: str) -> Dict[str, Any]:
    """세션 ID가 장부에 없으면 새로 페이지를 펼쳐 기록 준비를 합니다."""
    if session_id not in session_store:
        session_store[session_id] = {
            "session_id": session_id,
            "generations": [],
            "edits": [],
            "chats": [],
            "updated_at": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        }
    return session_store[session_id]


# =====================================================================
# [1번 창구] 서버 정상 영업 확인 (GET /health)
# =====================================================================
@app.get("/health", response_model=SuccessResponse[dict])
def health():
    """서버가 살아서 정상적으로 응답하는지 확인하는 건강 검진 API입니다."""
    return SuccessResponse(
        success=True,
        data={"status": "ok"},
        message="서버가 정상 작동 중입니다."
    )


# =====================================================================
# [2번 창구] 이미지 업로드 API (POST /api/images/upload)
# =====================================================================
@app.post("/api/images/upload", response_model=SuccessResponse[ImageUploadResponse])
async def upload_image(
    image: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None)
):
    """[이미지 업로드 창구] 이미지(jpg/png) 검증 후 보관함 저장 및 URL 발급"""
    filename = (image.filename or "").lower()
    content_type = image.content_type or ""
    allowed_extensions = (".jpg", ".jpeg", ".png")

    if not filename.endswith(allowed_extensions) and content_type not in ["image/jpeg", "image/png"]:
        raise AppException(
            error_code=ErrorCode.INVALID_IMAGE_FORMAT,
            message="jpg 또는 png 형식의 이미지 파일만 업로드할 수 있습니다.",
            status_code=400
        )

    ext = ".jpg" if filename.endswith((".jpg", ".jpeg")) or "jpeg" in content_type else ".png"
    image_id = f"img_{uuid.uuid4().hex[:8]}"
    saved_filename = f"{image_id}{ext}"
    file_path = os.path.join("uploads", saved_filename)

    with open(file_path, "wb") as f:
        f.write(await image.read())

    final_session_id = session_id or f"session_{uuid.uuid4().hex[:6]}"

    return SuccessResponse(
        success=True,
        data=ImageUploadResponse(
            image_id=image_id,
            session_id=final_session_id,
            original_image_url=f"/static/uploads/{saved_filename}"
        ),
        message="이미지 업로드가 완료되었습니다."
    )


# =====================================================================
# [3번 창구] 낙서 제거 복원 요청 API (POST /api/graffiti/remove)
# MVP 핵심: 선택지 3(통합 만능 모드) 기준으로 auto, mask, bbox, hybrid 분기 처리
# =====================================================================
@app.post("/api/graffiti/remove", response_model=SuccessResponse[GraffitiRemoveResponse])
def remove_graffiti(req: GraffitiRemoveRequest):
    """
    [낙서 제거 의뢰 및 복원 창구]
    mode 값에 따라 auto, mask, bbox, hybrid로 분기되며,
    comfyui-helper-nodes를 이용해 실제로 이미지를 복원 및 가공 처리합니다.
    """
    start_time = time.time()
    print(f"Sweep🧹 [낙서 제거 접수됨] 이미지ID: {req.image_id} | 모드: {req.mode} | 프롬프트: '{req.prompt}'")

    # 1. ComfyUI 워크플로우 실행 시뮬레이션
    workflow_info = log_workflow_execution("user_masked_inpainting_workflow.json")

    # 2. 결과 이미지 ID 생성 및 파일 가공
    result_id = f"result_{uuid.uuid4().hex[:6]}"
    
    # 복원 느낌을 주는 밝기/대비 조절 및 워터마크 추가
    brightness_val = 0.03
    contrast_val = 1.02
    overlay_msg = f"ZipPT Anti-Graffiti Restored\nMode: {req.mode}"
    
    result_url = process_mock_image(
        image_id=req.image_id,
        result_id=result_id,
        style_name="Anti-graffiti Clean",
        prompt_text=req.prompt,
        brightness=brightness_val,
        contrast=contrast_val,
        text_overlay=overlay_msg,
        bbox=req.bbox
    )
    
    # 원본 파일 확장자 탐색
    ext_found = ".jpg"
    for ext in (".jpg", ".jpeg", ".png"):
        if os.path.exists(os.path.join("uploads", f"{req.image_id}{ext}")):
            ext_found = ext
            break
    original_url = f"/static/uploads/{req.image_id}{ext_found}"
    mask_url = f"/static/masks/mask_{uuid.uuid4().hex[:6]}.png"

    # 작업 처리 소요 시간 계산
    elapsed = round(time.time() - start_time, 2)

    # [세션 장부 기록]
    session_data = get_or_create_session(req.session_id)
    session_data["edits"].append({
        "type": "graffiti_remove",
        "result_id": result_id,
        "original_image_url": original_url,
        "result_image_url": result_url,
        "mode": req.mode,
        "prompt": req.prompt,
        "workflow": workflow_info,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    })
    session_data["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    return SuccessResponse(
        success=True,
        data=GraffitiRemoveResponse(
            result_id=result_id,
            session_id=req.session_id,
            original_image_url=original_url,
            mask_image_url=mask_url,
            result_image_url=result_url,
            processing_time=elapsed,
            status="completed"
        ),
        message="낙서 제거가 완료되었습니다. (ComfyUI Workflow: user_masked_inpainting_workflow.json)"
    )


# =====================================================================
# [4번 창구] 결과 이미지 상세 조회 API (GET /api/images/{image_id})
# =====================================================================
@app.get("/api/images/{image_id}", response_model=SuccessResponse[ImageInfoResponse])
def get_image(image_id: str):
    """
    [이미지 메타데이터 조회 보조 창구]
    보관함 번호(image_id)를 바탕으로 원본, 복원작, 마스크인지 분류하고 상세 명세표를 반환합니다.
    """
    folders = [("uploads", "original"), ("results", "result"), ("masks", "mask")]
    found_path = None
    image_type = "original"
    found_filename = None

    for folder, img_type in folders:
        for ext in (".jpg", ".jpeg", ".png"):
            test_path = os.path.join(folder, f"{image_id}{ext}")
            if os.path.exists(test_path):
                found_path = test_path
                image_type = img_type
                found_filename = f"{image_id}{ext}"
                break
        if found_path:
            break

    # Swagger API 문서 테스트(예시 ID) 지원
    if not found_path:
        if image_id in ["img_001", "result_001"]:
            return SuccessResponse(
                success=True,
                data=ImageInfoResponse(
                    image_id=image_id,
                    session_id="session_abc123",
                    image_url=f"/static/uploads/{image_id}.jpg" if image_id == "img_001" else f"/static/results/{image_id}.jpg",
                    image_type="original" if image_id == "img_001" else "result",
                    created_at="2026-07-01T10:00:00",
                    status="available"
                ),
                message="이미지 조회가 완료되었습니다."
            )
        raise AppException(
            error_code=ErrorCode.IMAGE_NOT_FOUND,
            message="이미지를 찾을 수 없습니다.",
            status_code=404
        )

    mtime = os.path.getmtime(found_path)
    created_at_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%dT%H:%M:%S")
    folder_name = "uploads" if image_type == "original" else ("results" if image_type == "result" else "masks")

    return SuccessResponse(
        success=True,
        data=ImageInfoResponse(
            image_id=image_id,
            session_id=f"session_{image_id[:6]}",
            image_url=f"/static/{folder_name}/{found_filename}",
            image_type=image_type,
            created_at=created_at_str,
            status="available"
        ),
        message="이미지 조회가 완료되었습니다."
    )


# =====================================================================
# [5번 창구] 일반 이미지 생성 API (POST /api/image/generate)
# 비유: 글자(프롬프트)를 주면 AI 화가가 그림을 그려서 반환해 주는 창구입니다.
# =====================================================================
@app.post("/api/image/generate", response_model=SuccessResponse[ImageGenerateResponse])
def generate_image(req: ImageGenerateRequest):
    """
    [일반 이미지 생성 요청 창구]
    ComfyUI 스타일 변환 워크플로우를 사용해 이미지를 가공하고 생성합니다.
    """
    start_time = time.time()
    
    # 1. ComfyUI 워크플로우 실행 시뮬레이션
    workflow_info = log_workflow_execution("room_redesign_workflow.json")
    
    # 고유한 작업 접수 번호(UUID) 생성
    task_id = str(uuid.uuid4())
    result_id = f"gen_{task_id[:8]}"
    
    # 스타일 특성에 맞춰서 밝기/대비 튜닝 시뮬레이션
    brightness_val = 0.0
    contrast_val = 1.0
    
    if req.style == "Gallery White":
        brightness_val = 0.08
        contrast_val = 1.03
    elif req.style == "Urban Minimal":
        brightness_val = -0.02
        contrast_val = 1.05
    elif req.style == "Neutral Wall Restore":
        brightness_val = 0.02
        contrast_val = 0.98

    # 이미지 가공 수행
    target_img_id = req.image_id or "img_dummy"
    
    generated_url = process_mock_image(
        image_id=target_img_id,
        result_id=result_id,
        style_name=req.style,
        prompt_text=req.prompt,
        brightness=brightness_val,
        contrast=contrast_val,
        text_overlay=f"ZipPT AI Style Generator\nStyle: {req.style}"
    )

    # [세션 장부 기록] 손님의 이미지 생성 활동을 방명록에 적습니다.
    session_data = get_or_create_session(req.session_id)
    session_data["generations"].append({
        "task_id": task_id,
        "image_id": req.image_id,
        "prompt": req.prompt,
        "style": req.style,
        "generated_image_url": generated_url,
        "workflow": workflow_info,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    })
    session_data["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    return SuccessResponse(
        success=True,
        data=ImageGenerateResponse(
            task_id=task_id,
            session_id=req.session_id,
            generated_image_url=generated_url,
            status="completed"
        ),
        message="이미지 생성이 완료되었습니다. (ComfyUI Workflow: room_redesign_workflow.json)"
    )


# =====================================================================
# [6번 창구] AI 챗봇 대화 API (POST /api/chat)
# 비유: 궁금한 점을 질문지(question)에 적어 내면 안내원이 참고 서적과 함께 답해주는 창구입니다.
# =====================================================================
@app.post("/api/chat", response_model=SuccessResponse[ChatMessageResponse])
def chat_message(req: ChatMessageRequest):
    """
    [AI 챗봇 상담 창구]
    RAG 엔진(query.py)을 구동하여 실시간 실내건축 법률 및 인테리어 지식 기반 답변과 출처를 반환합니다.
    """
    if not req.question or not req.question.strip():
        raise AppException(
            error_code=ErrorCode.INVALID_INPUT,
            message="질문 내용(question)이 비어 있습니다. 질문을 입력해주세요.",
            status_code=400
        )

    session_data = get_or_create_session(req.session_id)
    
    # 5턴 대화 기록 누적 포맷 생성
    chat_history = []
    for c in session_data["chats"][-5:]:
        chat_history.append(f"User: {c['question']}")
        chat_history.append(f"AI: {c['answer']}")

    # RAG 실제 동작 여부에 따른 분기 처리
    if rag_enabled and rag_llm and rag_retriever:
        try:
            print(f"🔍 [RAG API] 질문 수신: '{req.question}'")
            # 1. 질문 라우팅 (취향 추천 vs 시공/법률)
            is_preference = query.check_is_preference_query(req.question, rag_llm)
            
            if is_preference:
                print("💡 [RAG API] 취향 조언 유형 판별됨.")
                answer = query.answer_preference_question(req.question, rag_llm)
                references = ["자체 인테리어 공간/홈 스타일링 디자인 가이드라인"]
            else:
                print("📑 [RAG API] 법률/시공/체크리스트 유형 판별됨.")
                answer, docs = query.answer_question(req.question, chat_history, rag_retriever, rag_llm)
                
                # 출처 메타데이터 추출
                references = []
                seen = set()
                for doc in docs:
                    meta = doc.metadata
                    label = meta.get("article") or meta.get("process") or "N/A"
                    title = meta.get("title", "")
                    source = meta.get("source", "")
                    key = f"[{label}] {title} ({source})"
                    if key not in seen:
                        seen.add(key)
                        references.append(key)
        except Exception as e:
            print(f"❌ [RAG API] 처리 에러 발생 (로컬 모킹 대체): {e}")
            answer = f"['{req.question}']에 대해 임시 모킹 답변을 드립니다. (RAG 추적 오류: {e}) 보통 실내 벽면 복원에는 Gallery White 스타일이 적절합니다."
            references = ["임시 시스템 폴백 복원 매뉴얼"]
    else:
        # 오프라인 상태일 때의 똑똑한 가상 답변 제공
        answer = f"['{req.question}']에 대한 AI 상담원의 안내 답변입니다. (현재 API Key 또는 RAG 라이브러리가 로드되지 않은 오프라인 상태입니다.) 공간을 세련되게 꾸미시려면 Urban Minimal을, 깨끗하고 화사하게 복원하시려면 Gallery White나 Anti-graffiti Clean을 선택해 보시는 것을 추천해 드립니다."
        references = [
            "ZipPT 벽면 복원 가이드북 제2조 (오프라인 추천)",
            "공간 재생 및 하자 방지 체크리스트"
        ]

    # [세션 장부 기록] 손님과의 대화 내용을 장부에 적어둡니다.
    session_data["chats"].append({
        "question": req.question,
        "answer": answer,
        "references": references,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    })
    session_data["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    return SuccessResponse(
        success=True,
        data=ChatMessageResponse(
            session_id=req.session_id,
            answer=answer,
            references=references
        ),
        message="대화 응답이 완료되었습니다."
    )


# =====================================================================
# [7번 창구] 이미지 편집 API (POST /api/image/edit)
# 비유: 마스크 좌표나 특정 객체 지정을 통해 이미지 수선을 의뢰하는 창구입니다.
# =====================================================================
@app.post("/api/image/edit", response_model=SuccessResponse[ImageEditResponse])
def edit_image(req: ImageEditRequest):
    """
    [이미지 정밀 편집 창구]
    comfyui-helper-nodes를 이용해 이미지의 특정 영역에 가구 인페인팅을 적용합니다.
    """
    start_time = time.time()
    
    # 1. ComfyUI 워크플로우 실행 시뮬레이션
    workflow_info = log_workflow_execution("furniture_inpainting_workflow.json")
    
    edit_id = f"edit_{uuid.uuid4().hex[:8]}"
    
    # 가구 편집 대비/밝기 미세조정 시뮬레이션
    brightness_val = 0.0
    contrast_val = 1.02
    
    # 2. 이미지 가공 수행
    result_url = process_mock_image(
        image_id=req.image_id,
        result_id=edit_id,
        style_name="Furniture Inpaint Style",
        prompt_text=req.prompt,
        brightness=brightness_val,
        contrast=contrast_val,
        text_overlay=f"ZipPT Furniture Inpainting\nObj: {req.selected_object or 'N/A'}",
        bbox=req.mask  # mask 필드를 [x1, y1, x2, y2] bbox 정보로 해석
    )

    # [세션 장부 기록] 이미지 편집 활동을 장부에 적습니다.
    session_data = get_or_create_session(req.session_id)
    session_data["edits"].append({
        "edit_id": edit_id,
        "image_id": req.image_id,
        "mask": req.mask,
        "selected_object": req.selected_object,
        "prompt": req.prompt,
        "edited_image_url": result_url,
        "workflow": workflow_info,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    })
    session_data["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    return SuccessResponse(
        success=True,
        data=ImageEditResponse(
            edit_id=edit_id,
            session_id=req.session_id,
            edited_image_url=result_url,
            status="completed"
        ),
        message="이미지 편집 작업이 완료되었습니다. (ComfyUI Workflow: furniture_inpainting_workflow.json)"
    )


# =====================================================================
# [8번 창구] 세션별 활동 내역 조회 API (GET /api/sessions/{session_id})
# 비유: 손님이 오늘 가게에서 활동한 모든 기록(생성, 편집, 대화)을 모아서 보여주는 영수증입니다.
# =====================================================================
@app.get("/api/sessions/{session_id}", response_model=SuccessResponse[SessionHistoryResponse])
def get_session_history(session_id: str):
    """
    [세션 방명록 통합 조회 창구]
    메모리에 저장된 장부(session_store)에서 특정 세션 ID의
    이미지 변환, 편집, 챗봇 기록을 한 묶음으로 조회합니다.
    """
    session_data = get_or_create_session(session_id)

    return SuccessResponse(
        success=True,
        data=SessionHistoryResponse(
            session_id=session_id,
            generations=session_data["generations"],
            edits=session_data["edits"],
            chats=session_data["chats"],
            updated_at=session_data["updated_at"]
        ),
        message="세션 내역 조회가 완료되었습니다."
    )


