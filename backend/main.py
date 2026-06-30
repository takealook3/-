# =====================================================================
# main.py: ZipPT API 백엔드 서버의 메인 안내 데스크 파일입니다.
# 비유: 병원이나 가게 입구에서 손님을 맞이하는 '안내 데스크' 역할을 합니다.
# =====================================================================

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import uuid, os

# schemas.py 파일에서 데이터 규격(신청서 양식)들을 가져옵니다.
from schemas import StyleTransferReq, ImageRes, ChatReq, ChatRes

app = FastAPI(title="ZipPT API")

# 사용자가 업로드한 이미지 파일을 저장할 'uploads' 폴더를 만듭니다.
os.makedirs("uploads", exist_ok=True)

@app.get("/health")
def health():
    """서버 건강 검진 주소"""
    return {"status": "ok"}


@app.post("/api/images")
async def upload_image(file: UploadFile = File(...)):
    """이미지 파일 업로드 접수 창구"""
    image_id = str(uuid.uuid4())
    path = f"uploads/{image_id}.png"
    with open(path, "wb") as f:
        f.write(await file.read())
    return {"image_id": image_id, "url": f"/api/images/{image_id}"}


@app.get("/api/images/{image_id}")
def get_image(image_id: str):
    """이미지 조회(발급) 창구"""
    path = f"uploads/{image_id}.png"
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")


# =====================================================================
# [NEW] 프론트엔드에서 버튼 클릭 시 진짜 요청을 보낼 주소 창구!
# =====================================================================
@app.post("/api/image/generate")
def generate_image_api(req: StyleTransferReq):
    """
    [이미지 생성/변환 API 창구]
    참고해 주신 requests.post("http://127.0.0.1:8000/api/image/generate") 요청을 접수합니다.
    비유: 미용실에 주문서(스타일, 강도)가 들어오면, 접수증(더미 응답)을 찍어 돌려주는 것입니다.
    """
    print(f"💌 [백엔드 접수됨] ID: {req.image_id} | 스타일: {req.style} | 강도: {req.strength}%")
    
    # 아직 실제 AI 모델이 연결되기 전이므로 더미 JSON 응답을 보냅니다.
    return {
        "status": "success",
        "result_image_id": req.image_id, # 받은 ID 그대로 반환
        "style_applied": req.style,
        "strength_applied": req.strength,
        "url": f"/api/images/{req.image_id}",
        "message": "백엔드 API 서버에서 성공적으로 더미 응답을 생성했습니다!"
    }


@app.post("/api/style-transfer", response_model=ImageRes)
def style_transfer(req: StyleTransferReq):
    """기존 스타일 변환 접수 창구"""
    return ImageRes(result_image_id="dummy", url="/api/images/dummy", status="ok")


@app.post("/api/chat", response_model=ChatRes)
def chat(req: ChatReq):
    """AI 챗봇 상담 창구"""
    return ChatRes(answer="🏠 AI 상담사: 거실이나 화장실 인테리어 관련해서 어떤 조언이 필요하신가요?", sources=[])
