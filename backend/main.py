# =====================================================================
# main.py: ZipPT API 백엔드 서버의 메인 안내 데스크 파일입니다.
# 비유: 병원이나 가게 입구에서 손님을 맞이하여 알맞은 진료실로 안내하는 
# '총괄 안내 데스크' 역할을 합니다.
# =====================================================================

from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import Optional, Dict, Any
import uuid, os, time, datetime

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
    현재 MVP 단계에서는 'auto' 중심의 더미 복원 결과를 생성하여 반환합니다.
    """
    start_time = time.time()
    print(f"🧹 [낙서 제거 접수됨] 이미지ID: {req.image_id} | 모드: {req.mode} | 프롬프트: '{req.prompt}'")

    original_url = f"/static/uploads/{req.image_id}.jpg"
    result_id = f"result_{uuid.uuid4().hex[:6]}"
    result_url = f"/static/results/{result_id}.jpg"
    mask_url = None

    # -----------------------------------------------------------------
    # ① 자동 감지 모드 (auto) - MVP 핵심 우선 구현 대상
    # -----------------------------------------------------------------
    if req.mode == "auto":
        print("🤖 [Auto Mode] AI가 자동으로 이미지 내부의 낙서를 탐지하여 제거합니다.")
        # TODO(MVP): 실제 AI 낙서 제거 인페인팅 모델 연결 영역
        # 현재 MVP 단계에서는 프론트엔드 연동 및 UI 흐름 검증을 위해 더미 마스크 및 복원 링크 발급
        mask_url = f"/static/masks/mask_{uuid.uuid4().hex[:6]}.png"

    # -----------------------------------------------------------------
    # ② 마스크 브러시 모드 (mask) - 추후 확장 대비 분기 구조
    # -----------------------------------------------------------------
    elif req.mode == "mask":
        print(f"🖌️ [Mask Mode] 전달된 마스크(ID: {req.mask_id}) 영역 집중 제거")
        mask_url = f"/static/masks/{req.mask_id}.png" if req.mask_id else f"/static/masks/mask_{uuid.uuid4().hex[:6]}.png"
        # TODO(추후): 마스크 영역 기준 인페인팅 로직 연결

    # -----------------------------------------------------------------
    # ③ 사각형 영역 모드 (bbox) - 추후 확장 대비 분기 구조
    # -----------------------------------------------------------------
    elif req.mode == "bbox":
        print(f"📐 [BBox Mode] 사각형 영역({req.bbox}) 내부 낙서 제거")
        mask_url = f"/static/masks/mask_bbox_{uuid.uuid4().hex[:6]}.png"
        # TODO(추후): 좌표 크롭 및 박스 마스크 생성 후 처리 로직 연결

    # -----------------------------------------------------------------
    # ④ 복합 모드 (hybrid) 등 기타
    # -----------------------------------------------------------------
    else:
        print(f"🔄 [Hybrid Mode] 복합 작업 모드 처리")
        mask_url = f"/static/masks/mask_hybrid_{uuid.uuid4().hex[:6]}.png"

    # 작업 처리 소요 시간 계산 (예시 규격인 2.14초 내외로 시뮬레이션)
    elapsed = round(time.time() - start_time + 2.14, 2)

    # [세션 장부 기록] 손님(session_id)의 활동 장부에 낙서 제거(편집) 내역을 기록합니다.
    session_data = get_or_create_session(req.session_id)
    session_data["edits"].append({
        "type": "graffiti_remove",
        "result_id": result_id,
        "original_image_url": original_url,
        "result_image_url": result_url,
        "mode": req.mode,
        "prompt": req.prompt,
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
        message="낙서 제거가 완료되었습니다."
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
    실제 무거운 AI 엔진(ControlNet)을 가동하지 않고, 즉시 사용 가능한
    더미 고유 UUID(task_id)와 결과물 URL을 발급하여 반환합니다.
    """
    # 고유한 작업 접수 번호(UUID) 생성
    task_id = str(uuid.uuid4())
    generated_url = f"/static/results/gen_{task_id[:8]}.jpg"

    # [세션 장부 기록] 손님의 이미지 생성 활동을 방명록에 적습니다.
    session_data = get_or_create_session(req.session_id)
    session_data["generations"].append({
        "task_id": task_id,
        "prompt": req.prompt,
        "style": req.style,
        "generated_image_url": generated_url,
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
        message="더미 이미지 생성이 완료되었습니다."
    )


# =====================================================================
# [6번 창구] AI 챗봇 대화 API (POST /api/chat)
# 비유: 궁금한 점을 질문지(question)에 적어 내면 안내원이 참고 서적과 함께 답해주는 창구입니다.
# =====================================================================
@app.post("/api/chat", response_model=SuccessResponse[ChatMessageResponse])
def chat_message(req: ChatMessageRequest):
    """
    [AI 챗봇 상담 창구]
    질문이 비어있으면 에러를 반환하고, 정상 질문 시에는 출처(references)가
    포함된 친절한 더미 답변을 반환합니다.
    """
    # 질문 종이가 비어있거나 공백만 있는 경우 예외(에러) 처리
    if not req.question or not req.question.strip():
        raise AppException(
            error_code=ErrorCode.INVALID_INPUT,
            message="질문 내용(question)이 비어 있습니다. 질문을 입력해주세요.",
            status_code=400
        )

    # 더미 답변 및 참고 출처 구성
    dummy_answer = f"['{req.question}']에 대한 AI 상담원의 더미 안내 답변입니다. 선택하신 영역에 최적화된 복원 및 편집 방법을 추천해 드립니다."
    dummy_references = [
        "https://example.com/guide/in-painting-tips",
        "ZipPT 벽면 복원 및 낙서 제거 매뉴얼 제3장"
    ]

    # [세션 장부 기록] 손님과의 대화 내용을 장부에 적어둡니다.
    session_data = get_or_create_session(req.session_id)
    session_data["chats"].append({
        "question": req.question,
        "answer": dummy_answer,
        "references": dummy_references,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    })
    session_data["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    return SuccessResponse(
        success=True,
        data=ChatMessageResponse(
            session_id=req.session_id,
            answer=dummy_answer,
            references=dummy_references
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
    mask 좌표, selected_object, prompt 입력을 받아 가공한 뒤
    수정 완료된 더미 이미지 주소를 반환합니다.
    """
    edit_id = f"edit_{uuid.uuid4().hex[:8]}"
    edited_url = f"/static/results/{edit_id}.jpg"

    # [세션 장부 기록] 이미지 편집 활동을 장부에 적습니다.
    session_data = get_or_create_session(req.session_id)
    session_data["edits"].append({
        "edit_id": edit_id,
        "image_id": req.image_id,
        "mask": req.mask,
        "selected_object": req.selected_object,
        "prompt": req.prompt,
        "edited_image_url": edited_url,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    })
    session_data["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    return SuccessResponse(
        success=True,
        data=ImageEditResponse(
            edit_id=edit_id,
            session_id=req.session_id,
            edited_image_url=edited_url,
            status="completed"
        ),
        message="이미지 편집 작업이 완료되었습니다."
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


