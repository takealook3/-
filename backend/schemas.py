# =====================================================================


# schemas.py: ZipPT API 꽌鍮꾩뒪쓽 쟾泥 뜲씠꽣 엯異쒕젰 洹쒓꺽(씤꽣럹씠뒪) 젙쓽꽌엯땲떎.


# 鍮꾩쑀: 슦泥닿뎅뿉꽌 깮諛곕굹 洹쒓꺽 遊됲닾瑜 蹂대궪 븣 젙빐吏 洹쒓꺽 긽옄뿉 떞븘빞 


# 遺꾩떎 뾾씠 븞쟾븯寃 諛곕떖릺뒗 寃껉낵 媛숈 뿭븷쓣 빀땲떎.


# =====================================================================





from pydantic import BaseModel, Field, field_validator


from typing import Optional, List, Generic, TypeVar, Literal, Any





T = TypeVar("T")








# =====================================================================


# [怨듯넻 洹쒓꺽 1] 뿉윭 肄붾뱶 紐⑸줉 (ErrorCode)


# 궗슜 API: 紐⑤뱺 API뿉꽌 떎뙣/삤瑜 諛쒖깮 떆 뿉윭 궗쑀瑜 遺꾨쪟븯湲 쐞빐 궗슜


# =====================================================================


class ErrorCode:


    """


    [뿉윭 肄붾뱶 紐⑥쓬吏]


    鍮꾩쑀: 蹂묒썝씠굹 李쎄뎄뿉꽌 吏꾨즺 젒닔媛 諛섎젮릺뿀쓣 븣 븞궡븯뒗 궗쑀 肄붾뱶엯땲떎.


    """


    INVALID_IMAGE_FORMAT = "INVALID_IMAGE_FORMAT"   # 씠誘몄 삎떇씠 옒紐삳맖 (jpg/png 븘떂)


    IMAGE_NOT_FOUND = "IMAGE_NOT_FOUND"             # 씠誘몄瑜 李얠쓣 닔 뾾쓬


    RESULT_NOT_FOUND = "RESULT_NOT_FOUND"           # 蹂듭썝 寃곌낵 씠誘몄瑜 李얠쓣 닔 뾾쓬


    MASK_NOT_FOUND = "MASK_NOT_FOUND"               # 留덉뒪겕 씠誘몄瑜 李얠쓣 닔 뾾쓬


    PROCESSING_FAILED = "PROCESSING_FAILED"         # AI 씠誘몄 泥섎━ 떎뙣


    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"         # 옉뾽 꽭뀡쓣 李얠쓣 닔 뾾쓬


    PROMPT_REQUIRED = "PROMPT_REQUIRED"             # 프롬프트 필수값 누락


    INVALID_INPUT = "INVALID_INPUT"                 # 븘닔 엯젰媛(삁: 吏덈Ц 궡슜)씠 鍮꾩뼱엳嫄곕굹 옒紐삳맖


    SERVER_ERROR = "SERVER_ERROR"                   # 꽌踰 궡遺 삤瑜


    MODEL_NOT_FOUND = "MODEL_NOT_FOUND"             # Realistic Vision 등 모델 파일을 찾을 수 없음


    MODEL_LOAD_FAILED = "MODEL_LOAD_FAILED"         # 모델 로딩 실패


    IMAGE_GENERATION_FAILED = "IMAGE_GENERATION_FAILED" # 이미지 생성 중 오류 발생


    CUDA_OUT_OF_MEMORY = "CUDA_OUT_OF_MEMORY"       # GPU 메모리 부족


    MASK_REQUIRED = "MASK_REQUIRED"                 # 수정할 마스크나 영역이 선택되지 않음


    REGION_REQUIRED = "REGION_REQUIRED"             # bbox 좌표가 없음


    INPAINTING_FAILED = "INPAINTING_FAILED"         # 부분 가구 교체/수정 생성 실패








# =====================================================================


# [怨듯넻 洹쒓꺽 2] 꽦怨 쓳떟 몴以 遊됲닾 (SuccessResponse)


# 궗슜 API: GET /health, POST /api/images/upload, POST /api/graffiti/remove 벑 紐⑤뱺 API 꽦怨 쓳떟


# =====================================================================


class SuccessResponse(BaseModel, Generic[T]):


    """


    [怨듯넻 꽦怨 쓳떟 몴以 遊됲닾]


    鍮꾩쑀: 紐⑤뱺 븣留뱀씠 꽌瑜(data)瑜 떞븘꽌 뱶由щ뒗 怨듭떇 洹쒓꺽 꽦怨 遊됲닾엯땲떎.


    """


    success: bool = Field(True, description="꽦怨 뿬遺 (빆긽 true)")


    data: T = Field(..., description="쓳떟 븣留뱀씠 뜲씠꽣")


    message: str = Field("슂泥씠 꽦怨듯뻽뒿땲떎.", description="븞궡 硫붿떆吏")








# =====================================================================


# [怨듯넻 洹쒓꺽 3] 떎뙣(뿉윭) 쓳떟 몴以 遊됲닾 (ErrorResponse)


# 궗슜 API: 紐⑤뱺 API뿉꽌 삁쇅(AppException 벑) 諛쒖깮 떆 諛섑솚릺뒗 떎뙣 쓳떟


# =====================================================================


class ErrorResponse(BaseModel):


    """


    [1. 怨듯넻 떎뙣(뿉윭) 쓳떟 몴以 遊됲닾]


    봽濡좏듃뿏뱶뿉꽌 response.success == false 濡 떎뙣 뿬遺瑜 뙋떒븯怨 error_code瑜 솗씤빀땲떎.


    """


    success: bool = Field(False, description="꽦怨 뿬遺 (빆긽 false)")


    error_code: str = Field(..., description="뿉윭 궗쑀 肄붾뱶 (ErrorCode 紐⑸줉 李멸퀬)")


    message: str = Field(..., description="궗슜옄 移쒗솕쟻씤 뿉윭 긽꽭 꽕紐 硫붿떆吏")








# =====================================================================


# [API 1 洹쒓꺽] 씠誘몄 뾽濡쒕뱶 븣留뱀씠 (ImageUploadResponse)


# 궗슜 API: POST /api/images/upload 쓳떟(data)쑝濡 궗슜


# =====================================================================


class ImageUploadResponse(BaseModel):


    """


    [2. 씠誘몄 뾽濡쒕뱶 꽦怨 븣留뱀씠 洹쒓꺽]


    鍮꾩쑀: 궗吏 젒닔 李쎄뎄뿉 썝蹂 궗吏꾩쓣 젣異쒗븳 뮘 룎젮諛쏅뒗 젒닔 蹂닿利앹엯땲떎.


    """


    image_id: str = Field(..., description="옣맂 씠誘몄 怨좎쑀 ID (삁: img_001)")


    session_id: Optional[str] = Field(None, description="궗슜옄 옉뾽 꽭뀡 ID")


    original_image_url: str = Field(..., description="썝蹂 씠誘몄 議고쉶 젙쟻 URL (삁: /static/uploads/img_001.jpg)")








# =====================================================================


# [API 2 洹쒓꺽] 굺꽌 젣嫄 슂泥 二쇰Ц꽌 (GraffitiRemoveRequest)


# 궗슜 API: POST /api/graffiti/remove 슂泥 諛붾뵒(Request Body)濡 궗슜


# =====================================================================


class GraffitiRemoveRequest(BaseModel):


    """


    [3. 굺꽌 젣嫄 넻빀 二쇰Ц꽌 뼇떇]


    鍮꾩쑀: 궗吏 蹂듭썝떎뿉 궗吏(image_id)怨 蹂듭썝 諛⑹떇(mode)쓣 꽑깮빐 쓽猶고븯뒗 醫낇빀 옉뾽 떊泥꽌엯땲떎.


    """


    image_id: str = Field(..., description="썝蹂 씠誘몄 怨좎쑀 ID (삁: img_001)")


    session_id: str = Field(..., description="궗슜옄 옉뾽 꽭뀡 ID (삁: session_abc123)")


    mode: Literal["auto", "mask", "bbox", "hybrid"] = Field(


        "auto", 


        description="옉뾽 紐⑤뱶 (auto, mask, bbox, hybrid 以 븯굹留 뿀슜)"


    )


    prompt: Optional[str] = Field(


        "Remove graffiti and restore the original wall texture", 


        description="AI 紐⑤뜽뿉寃 쟾떖븷 吏떆臾"


    )


    mask_id: Optional[str] = Field(None, description="留덉뒪겕 씠誘몄 ID (mask 紐⑤뱶 떆 궗슜)")


    bbox: Optional[List[int]] = Field(None, description="굺꽌 쁺뿭 궗媛곹삎 醫뚰몴 [x1, y1, x2, y2] (bbox 紐⑤뱶 떆 궗슜)")





    @field_validator("mode")


    @classmethod


    def validate_mode(cls, v: str) -> str:


        """


        [mode 븘뱶 寃利앷린]


        auto, mask, bbox, hybrid 씠쇅쓽 媛믪씠 뱾뼱삤硫 뿉윭瑜 諛쒖깮떆궢땲떎.


        """


        allowed = {"auto", "mask", "bbox", "hybrid"}


        if v not in allowed:


            raise ValueError(f"mode 媛믪 auto, mask, bbox, hybrid 以 븯굹뿬빞 빀땲떎. (쟾떖맂 媛: {v})")


        return v








# =====================================================================


# [API 2 洹쒓꺽] 굺꽌 젣嫄 셿꽦 寃곌낵꽌 (GraffitiRemoveResponse)


# 궗슜 API: POST /api/graffiti/remove 쓳떟(data)쑝濡 궗슜


# =====================================================================


class GraffitiRemoveResponse(BaseModel):


    """


    [4. 굺꽌 젣嫄 泥섎━ 寃곌낵꽌 븣留뱀씠 뼇떇]


    鍮꾩쑀: 蹂듭썝씠 걹궃 썑 셿꽦 궗吏 諛 옉뾽 냼슂 떆媛꾩씠 쟻 엳뒗 紐낆꽭꽌엯땲떎.


    """


    result_id: str = Field(..., description="굺꽌媛 젣嫄곕맂 理쒖쥌 셿꽦 씠誘몄 ID (삁: result_001)")


    session_id: str = Field(..., description="궗슜옄 옉뾽 꽭뀡 ID")


    original_image_url: str = Field(..., description="썝蹂 씠誘몄 議고쉶 二쇱냼 (삁: /static/uploads/img_001.jpg)")


    mask_image_url: Optional[str] = Field(None, description="쟻슜맂 留덉뒪겕 씠誘몄 二쇱냼 (삁: /static/masks/mask_001.png)")


    result_image_url: str = Field(..., description="理쒖쥌 셿꽦 씠誘몄 議고쉶 二쇱냼 (삁: /static/results/result_001.jpg)")


    processing_time: float = Field(..., description="옉뾽 泥섎━ 냼슂 떆媛 珥 떒쐞 (삁: 2.14)")


    status: str = Field("completed", description="泥섎━ 寃곌낵 긽깭 (삁: completed)")








# =====================================================================


# [API 3 洹쒓꺽] 寃곌낵 씠誘몄 긽꽭 議고쉶 븣留뱀씠 (ImageInfoResponse)


# 궗슜 API: GET /api/images/{image_id} 쓳떟(data)쑝濡 궗슜


# =====================================================================


class ImageInfoResponse(BaseModel):


    """


    [5. 寃곌낵 씠誘몄 긽꽭 硫뷀뜲씠꽣 젙蹂 븣留뱀씠 洹쒓꺽]


    鍮꾩쑀: 궗吏 蹂닿븿 踰덊샇濡 議고쉶뻽쓣 븣 굹삤뒗 궗吏꾩쓽 긽꽭 씠젰 諛 떎슫濡쒕뱶 븞궡꽌엯땲떎.


    """


    image_id: str = Field(..., description="議고쉶븳 씠誘몄 怨좎쑀 ID (삁: img_001)")


    session_id: str = Field(..., description="뿰寃곕맂 궗슜옄 옉뾽 꽭뀡 ID (삁: session_abc123)")


    image_url: str = Field(..., description="젙쟻 씠誘몄 議고쉶 諛 떎슫濡쒕뱶 留곹겕 二쇱냼")


    image_type: str = Field(..., description="씠誘몄 遺꾨쪟 (original: 썝蹂, result: 蹂듭썝寃곌낵, mask: 留덉뒪겕)")


    created_at: str = Field(..., description="씠誘몄 깮꽦 씪떆 (삁: 2026-07-01T10:00:00)")


    status: str = Field("available", description="씠誘몄 뿴엺 媛뒫 긽깭 (삁: available)")








# =====================================================================


# [NEW API 4 洹쒓꺽] 씠誘몄 깮꽦 슂泥/寃곌낵 뼇떇 (POST /api/image/generate)


# =====================================================================


class ImageGenerateRequest(BaseModel):
    """
    [이미지 생성 주문서]
    ControlNet 등 생성 AI 모델에 이미지 합성을 요청하는 주문서입니다.
    """
    session_id: str = Field("session_default", description="사용자 작업 세션 ID")
    prompt: str = Field(..., description="생성하고 싶은 이미지 설명 글")
    style: Optional[str] = Field("realistic", description="스타일 옵션")
    image_id: Optional[str] = Field(None, description="원본 이미지 고유 ID")
    strength: Optional[float] = Field(65.0, description="스타일 변환 강도 (0~100)")
    keep_structure: Optional[bool] = Field(True, description="기존 공간 구조 유지 여부")
    mode: Optional[str] = Field("style_transform", description="작업 모드 (style_transform 또는 inpainting)")
    mask: Optional[Any] = Field(None, description="마스크 정보 (좌표 리스트 또는 문자열)")
    bbox: Optional[Any] = Field(None, description="바운딩 박스 좌표 dict 또는 list")


class ImageGenerateResponse(BaseModel):


    """


    [씠誘몄 깮꽦 寃곌낵꽌]


    깮꽦맂 뜑誘 씠誘몄 URL怨 怨좎쑀 task_id瑜 룎젮二쇰뒗 븣留뱀씠 뼇떇엯땲떎.


    """


    task_id: str = Field(..., description="옉뾽 怨좎쑀 UUID (삁: 550e8400-e29b-41d4-a716-446655440000)")


    session_id: str = Field(..., description="궗슜옄 옉뾽 꽭뀡 ID")


    generated_image_url: str = Field(..., description="깮꽦맂 씠誘몄 솗씤 留곹겕 (삁: /static/results/gen_001.jpg)")


    status: str = Field("completed", description="옉뾽 泥섎━ 긽깭")








# =====================================================================


# [NEW API 5 洹쒓꺽] 梨쀫큸 RAG 솕 슂泥/寃곌낵 뼇떇 (POST /api/chat)


# =====================================================================


class ChatMessageRequest(BaseModel):


    """


    [梨쀫큸 솕 吏덈Ц꽌]


    궗슜옄媛 AI 뼱떆뒪꽩듃뿉寃 蹂대궡뒗 吏덈Ц 뼇떇엯땲떎.


    """


    session_id: str = Field(..., description="궗슜옄 옉뾽 꽭뀡 ID")


    question: str = Field(..., description="궗슜옄 吏덈Ц 궡슜 (鍮꾩뼱엳쑝硫 뿉윭 泥섎━맖)")


    image_id: Optional[str] = Field(None, description="인테리어 원본 이미지 ID (변환용)")


    style: Optional[str] = Field(None, description="변환할 인테리어 스타일")








class ChatMessageResponse(BaseModel):


    """


    [梨쀫큸 솕 떟蹂꽌]


    AI 떟蹂怨 李멸퀬 臾몄꽌 異쒖쿂(references 諛곗뿴)瑜 떞 븣留뱀씠 뼇떇엯땲떎.


    """


    session_id: str = Field(..., description="궗슜옄 옉뾽 꽭뀡 ID")


    answer: str = Field(..., description="AI 뜑誘 떟蹂 궡슜")


    references: List[str] = Field(default_factory=list, description="떟蹂 옉꽦뿉 李멸퀬븳 異쒖쿂 紐⑸줉 諛곗뿴")


    image_url: Optional[str] = Field(None, description="스타일 참고 이미지 URL")


    result_id: Optional[str] = Field(None, description="인테리어 변환 결과 이미지 ID")


    original_image_url: Optional[str] = Field(None, description="원본 이미지 URL")


    style: Optional[str] = Field(None, description="변환 스타일")


    prompt: Optional[str] = Field(None, description="변환 프롬프트")


    processing_time: Optional[float] = Field(None, description="변환 소요 시간")








# =====================================================================


# [NEW API 6 洹쒓꺽] 씠誘몄 렪吏 슂泥/寃곌낵 뼇떇 (POST /api/image/edit)


# =====================================================================


class ImageEditRequest(BaseModel):


    """


    [씠誘몄 렪吏 쓽猶곗꽌]


    留덉뒪겕 醫뚰몴, 꽑깮븳 媛앹껜, 닔젙 吏떆臾(prompt)쓣 諛쏆븘 렪吏묒쓣 쓽猶고븯뒗 뼇떇엯땲떎.


    """


    image_id: str = Field(..., description="렪吏묓븷 긽 씠誘몄 ID (삁: img_001)")


    session_id: str = Field(..., description="궗슜옄 옉뾽 꽭뀡 ID")


    mask: Optional[Any] = Field(None, description="1차 마스크 영역 정보 (좌표 [x1,y1,x2,y2] 또는 Base64 PNG 이미지)")


    mask_b: Optional[Any] = Field(None, description="2차 마스크 영역 정보 (좌표 [x1,y1,x2,y2] 또는 Base64 PNG 이미지)")


    selected_object: Optional[str] = Field(None, description="꽑깮맂 媛앹껜 紐낆묶 (삁: graffiti, sign)")


    prompt: str = Field("Replace graffiti with clean brick texture", description="1차 렪吏 吏떆臾")


    prompt_b: Optional[str] = Field(None, description="2차 렪吏 吏떆臾")


    steps: Optional[int] = Field(None, description="KSampler 연산 단계 수 (선택)")


    cfg: Optional[float] = Field(None, description="프롬프트 유도 가중치 (선택)")


    denoise: Optional[float] = Field(None, description="노이즈 제거 강도 (선택)")

    # 버그② 수정: Base64 마스크와 별개로 픽셀 좌표 BBox를 직접 전달하는 필드
    # mock 폴백 모드에서 Base64 문자열의 len()이 4가 아니어서 가구 교체가 스킵되던 버그 방지
    mask_pixels_a: Optional[List[int]] = Field(None, description="1차 마스크 픽셀 좌표 [x1,y1,x2,y2] (mock 폴백용)")

    mask_pixels_b: Optional[List[int]] = Field(None, description="2차 마스크 픽셀 좌표 [x1,y1,x2,y2] (mock 폴백용)")








class ImageEditResponse(BaseModel):


    """


    [씠誘몄 렪吏 寃곌낵꽌]


    씤럹씤똿 렪吏묒씠 셿猷뚮맂 뜑誘 씠誘몄 URL쓣 떞 븣留뱀씠 뼇떇엯땲떎.


    """


    edit_id: str = Field(..., description="렪吏 셿猷뚮맂 씠誘몄 怨좎쑀 ID (삁: edit_001)")


    session_id: str = Field(..., description="궗슜옄 옉뾽 꽭뀡 ID")


    edited_image_url: str = Field(..., description="렪吏 셿猷뚮맂 씠誘몄 議고쉶 留곹겕")


    status: str = Field("completed", description="옉뾽 泥섎━ 긽깭")








# =====================================================================


# [NEW API 7 洹쒓꺽] 꽭뀡蹂 넻빀 궡뿭 議고쉶 뼇떇 (GET /api/sessions/{session_id})


# =====================================================================


class SessionHistoryResponse(BaseModel):
    """
    [세션 누적 방명록 규격]
    비유: 손님이 가게에서 활동한 모든 기록을 묶어 보여주는 종합 장부입니다.
    """
    session_id: str = Field(..., description="조회한 세션 ID")
    generations: List[dict] = Field(default_factory=list, description="이미지 생성 내역 목록")
    edits: List[dict] = Field(default_factory=list, description="이미지 편집 및 낙서 제거 내역 목록")
    chats: List[dict] = Field(default_factory=list, description="챗봇 대화 내역 목록")
    results: List[dict] = Field(default_factory=list, description="통합 이미지 결과 목록")
    updated_at: str = Field(..., description="최근 활동 일시")


# =====================================================================
# [NEW API 8 규격] 유사 상품 검색 요청/결과 양식 (POST /api/products/search)
# =====================================================================

class ProductItem(BaseModel):
    """
    [유사 상품 정보 규격]
    """
    product_name: str = Field(..., description="상품명")
    price: str = Field(..., description="가격 정보 (예: 150,000원)")
    image_url: str = Field(..., description="상품 이미지 URL")
    purchase_link: str = Field(..., description="구매 링크")
    similarity: float = Field(..., description="유사도 점수 (0.0~1.0)")


class ProductSearchResponse(BaseModel):
    """
    [유사 상품 검색 결과 목록]
    """
    products: List[ProductItem] = Field(default_factory=list, description="유사 상품 목록")


# =====================================================================
# [NEW API 9 규격] 부분 가구 교체 및 수정 요청/결과 양식 (POST /api/image/inpaint)
# =====================================================================

class ImageInpaintRequest(BaseModel):
    """
    [부분 가구 교체 주문서 (Image Inpainting)]
    사용자가 선택한 영역(bbox 또는 mask) 내의 가구만 교체하도록 요청하는 주문서입니다.
    """
    image_id: str = Field(..., description="원본 이미지 ID (예: img_001)")
    session_id: str = Field(..., description="작업 세션 ID")
    mode: Optional[str] = Field("inpainting", description="작업 모드 (기본값: inpainting)")
    prompt: str = Field(..., description="수정 프롬프트 (예: 하얀색 소파로 교체)")
    mask: Optional[Any] = Field(None, description="마스크 영역 정보")
    bbox: Optional[Any] = Field(None, description="바운딩 박스 정보 {x, y, width, height} 또는 [x, y, w, h]")
    selected_object: Optional[str] = Field(None, description="선택된 가구 객체명")


class ImageInpaintResponse(BaseModel):
    """
    [부분 가구 교체 완료서]
    Realistic Vision V6.0 B1 기반 인페인팅 결과를 반환하는 응답 규격입니다.
    """
    result_id: str = Field(..., description="수정된 결과 이미지 고유 ID")
    image_id: str = Field(..., description="원본 이미지 ID")
    session_id: str = Field(..., description="작업 세션 ID")
    mode: str = Field("inpainting", description="작업 모드")
    prompt: str = Field(..., description="수정 프롬프트")
    result_image_url: str = Field(..., description="수정 완료된 결과 이미지 URL")
    processing_time: float = Field(..., description="작업 소요 시간(초)")
    status: str = Field("completed", description="처리 상태")
    message: str = Field("선택 영역 가구 수정이 완료되었습니다.", description="결과 안내 메시지")


# =====================================================================
# [NEW API 10 규격] 드래그 영역 CLIP 임베딩 추출 응답 양식 (POST /api/images/embed-crop)
# =====================================================================

class CropEmbeddingResponse(BaseModel):
    """
    [드래그 영역 CLIP 임베딩 결과 규격]
    비유: 디자이너가 오려낸 가구 사진 조각에서 추출한 512차원 특징값 리스트입니다.
    """
    embedding: List[float] = Field(..., description="512차원의 정규화된 CLIP 임베딩 벡터 값")
    dimension: int = Field(512, description="벡터 차원 크기 (기본값: 512)")
    bbox: List[int] = Field(..., description="크롭에 사용된 실제 픽셀 좌표 바운딩 박스 [px1, py1, px2, py2]")
    model_name: str = Field("", description="분석에 사용된 실제 이미지 인코더 모델 이름")
    status_steps: List[str] = Field([], description="CLIP 분석 처리 단계 리스트")


