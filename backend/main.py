# =====================================================================
# main.py: ZipPT API 백엔드 서버의 메인 안내 데스크 파일입니다.
# 비유: 병원이나 가게 입구에서 손님을 맞이하는 '안내 데스크' 역할을 합니다.
# =====================================================================

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import uuid, os

# schemas.py 파일에서 데이터 규격(신청서 양식)들을 가져옵니다.
# 비유: 안내 데스크 옆의 서류함에서 필요한 접수 양식 종이들을 꺼내오는 것과 같습니다.
from schemas import StyleTransferReq, ImageRes, ChatReq, ChatRes

# FastAPI 서버 앱을 생성합니다. ("ZipPT API"라는 이름의 온라인 간판을 거는 것과 같습니다)
app = FastAPI(title="ZipPT API")

# 사용자가 업로드한 이미지 파일을 저장할 'uploads' 폴더(보관함)를 만듭니다.
# exist_ok=True는 이미 폴더가 있다면 새로 만들지 않고 그대로 둔다는 의미입니다.
# 비유: 가게 뒷편에 손님들의 물건을 보관할 창고 방을 하나 마련하는 것과 같습니다.
os.makedirs("uploads", exist_ok=True)

@app.get("/health")
def health():
    """
    [서버 건강 검진(Health Check) 주소]
    서버가 살아서 잘 작동하고 있는지 확인하는 기능입니다.
    비유: 환자의 맥박을 짚어보고 "정상(ok)입니다!"라고 확인해 주는 것과 같습니다.
    """
    return {"status": "ok"}


@app.post("/api/images")
async def upload_image(file: UploadFile = File(...)):
    """
    [이미지 파일 업로드 접수 창구]
    사용자가 컴퓨터나 스마트폰에서 보낸 이미지 파일을 서버의 'uploads' 폴더에 안전하게 저장합니다.
    비유: 손님이 액자에 넣을 사진 실물을 안내 데스크에 제출하면, 고유 번호표(uuid)를 붙여 창고에 보관하고 보관증(url)을 주는 것과 같습니다.
    """
    # 전 세계에서 유일한 고유 번호(UUID)를 생성하여 파일 이름이 겹치지 않도록 합니다.
    image_id = str(uuid.uuid4())
    # 파일이 저장될 경로를 지정합니다. (예: uploads/123e4567-e89b-12d3-a456-426614174000.png)
    path = f"uploads/{image_id}.png"
    
    # 파일을 열어서 사용자가 보낸 이미지 데이터를 그대로 기록(저장)합니다.
    with open(path, "wb") as f:
        f.write(await file.read())
        
    # 저장된 이미지의 고유 번호와 확인할 수 있는 주소를 돌려줍니다.
    return {"image_id": image_id, "url": f"/api/images/{image_id}"}


@app.get("/api/images/{image_id}")
def get_image(image_id: str):
    """
    [이미지 조회(발급) 창구]
    손님이 가져온 이미지 번호표(image_id)를 확인하고, 창고('uploads')에서 해당 사진을 꺼내 보여줍니다.
    비유: 물품 보관소에 보관증을 내밀면 실물 물건(사진 파일)을 찾아 건네주는 것과 같습니다.
    """
    path = f"uploads/{image_id}.png"
    # 만약 창고에 사진이 존재한다면 사진 파일 그대로 응답합니다.
    if os.path.exists(path):
        return FileResponse(path)
    # 만약 사진이 없다면 404 에러(찾을 수 없음)를 안내합니다.
    raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")


@app.post("/api/style-transfer", response_model=ImageRes)
def style_transfer(req: StyleTransferReq):
    """
    [스타일 변환 접수 창구]
    사용자가 보낸 이미지와 스타일 옵션을 받아 스타일 변환 작업을 접수합니다.
    비유: 미용실에서 "이 사진처럼 머리 잘라주세요"라고 주문서를 제출하면 임시 영수증을 발급해 주는 것과 같습니다.
    """
    # TODO: 나중에 P1의 ControlNet 함수 연결
    return ImageRes(result_image_id="dummy", url="/api/images/dummy")


@app.post("/api/inpaint", response_model=ImageRes)
def inpaint(req: StyleTransferReq):
    """
    [이미지 인페인팅(수정) 접수 창구]
    이미지에서 원하는 부분을 지우거나 새롭게 채워 넣는 작업을 접수합니다.
    비유: 사진관에서 "사진 배경에 있는 장애물 좀 지워주세요"라고 요청을 접수받는 것과 같습니다.
    """
    # TODO: 나중에 P2의 Inpainting 함수 연결
    return ImageRes(result_image_id="dummy", url="/api/images/dummy")


@app.post("/api/chat", response_model=ChatRes)
def chat(req: ChatReq):
    """
    [AI 챗봇 상담 창구]
    사용자의 질문 메시지를 받아 AI가 답변을 제공하는 창구입니다.
    비유: 안내 데스크에 있는 AI 직원에게 질문을 던지면 답변과 함께 참고 서적 목록을 알려주는 것과 같습니다.
    """
    # TODO: 나중에 P3의 RAG 챗봇 함수 연결
    return ChatRes(answer="아직 준비 중이에요", sources=[])
