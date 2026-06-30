# =====================================================================
# schemas.py: 프론트엔드와 백엔드가 주고받을 데이터 규격(신청서 양식)을 정의합니다.
# 비유: 우체국에서 택배를 보낼 때 정해진 규격 상자에 담고 운송장을 붙여야 
# 분실 없이 안전하게 배달되는 것과 같습니다.
# =====================================================================

from pydantic import BaseModel
from typing import Optional

class StyleTransferReq(BaseModel):   
    """
    [스타일 변환 주문서] 프론트엔드가 보낼 때 사용하는 규격
    비유: 미용실에 가서 "이 사진(image_id)을 이런 머리 스타일(style)로 해주세요!"라고 주문하는 것
    """
    image_id: str           # 변환할 원본 이미지의 고유 번호 (문자열)
    style: str              # 적용하고 싶은 스타일 이름
    strength: int = 65      # 변환 강도 (0~100, 기본값 65)

class ImageRes(BaseModel):           
    """
    [스타일 변환 결과물] 백엔드가 돌려줄 때 사용하는 규격
    """
    result_image_id: str  # 완성된 결과 이미지의 고유 번호
    url: str              # 완성된 이미지를 확인할 수 있는 인터넷 링크 주소
    status: str = "ok"    # 처리 상태 결과

class ChatReq(BaseModel):
    session_id: str  
    message: str     

class ChatRes(BaseModel):
    answer: str             
    sources: list[str] = [] 
