# =========================================================
# 인테리어 변경 AI 웹 애플리케이션 프론트엔드 (app.py)
# =========================================================
import streamlit as st
import time
import requests
from PIL import Image, ImageDraw
from streamlit_drawable_canvas import st_canvas

# 🐒 Streamlit 1.30+ 버전과 streamlit-drawable-canvas 간의 호환성 버그 해결을 위한 멍키 패치
class DummyLayoutConfig:
    def __init__(self, width):
        self.width = width

try:
    import streamlit.elements.image as st_image
    from streamlit.elements.lib.image_utils import image_to_url as original_image_to_url
    
    def wrapped_image_to_url(image, width_or_config, *args, **kwargs):
        if isinstance(width_or_config, int):
            layout_config = DummyLayoutConfig(width=width_or_config)
        else:
            layout_config = width_or_config
        return original_image_to_url(image, layout_config, *args, **kwargs)
        
    st_image.image_to_url = wrapped_image_to_url
except Exception:
    pass

st.set_page_config(page_title="AI 인테리어 스튜디오", page_icon="🏠", layout="wide")

BACKEND_URL = "http://127.0.0.1:8000"

# =========================================================
# 백엔드 API 호출 함수들
# =========================================================
def request_image_generation(image_id, style, strength, prompt, keep_structure):
    """백엔드에 이미지 생성/스타일 변환을 요청합니다."""
    url = f"{BACKEND_URL}/api/image/generate"
    payload = {
        "session_id": "room_1",
        "image_id": image_id,
        "style": style,
        "strength": float(strength),
        "prompt": prompt,
        "keep_structure": keep_structure
    }
    response = requests.post(url, json=payload, timeout=240)
    return response.json()


def call_api_transform_interior(image_file, strength, prompt, keep_structure):
    """입력 화면에서 '변환하기' 버튼을 눌렀을 때 호출되는 메인 처리 함수"""
    try:
        # 1단계: 백엔드 이미지 업로드
        files = {"image": ("upload.png", image_file.getvalue(), "image/png")}
        up_res = requests.post(f"{BACKEND_URL}/api/images/upload", files=files, timeout=10)
        res_data = up_res.json()
        
        if not res_data.get("success"):
            st.error(f"이미지 업로드 실패: {res_data.get('message')}")
            return None
            
        image_id = res_data.get("data", {}).get("image_id")
        # ✅ 핵심 수정: 원본 image_id를 두 곳에 저장 - 하나는 일반용, 하나는 편집 전용
        # original_upload_id는 절대 덮어쓰지 않음 (편집 시 이 파일을 찾아야 하므로)
        st.session_state.last_uploaded_image_id = image_id
        st.session_state.original_upload_id = image_id
        
        # 2단계: 스타일 변환 수행
        api_result = request_image_generation(image_id, "Custom Style", strength, prompt, keep_structure)
        
        if api_result.get("success"):
            data = api_result.get("data", {})
            generated_url = data.get("generated_image_url")
            if not generated_url:
                st.error("이미지 생성 URL이 비어 있습니다.")
                return None
            result_url = BACKEND_URL + generated_url
            # ✅ 핵심 수정: task UUID로 last_uploaded_image_id를 덮어쓰지 않음!
            # (이전 버그: data.get("task_id")로 덮어쓰면 편집 시 원본 파일을 못 찾음)
            st.session_state.result_image = result_url
            st.session_state.last_workflow_info = data.get("workflow") or {
                "workflow": "room_redesign_workflow.json",
                "status": "loaded",
                "nodes": ["LoadImage", "ControlNetLoader", "CLIPTextEncode", "KSampler", "VAEDecode", "SaveImage"],
                "comfyui_status": "offline",
                "execution_mode": "mock_fallback"
            }
            st.toast("✅ 백엔드 인테리어 변환 통신 성공!")
            return result_url
        else:
            st.error(f"스타일 변환 실패: {api_result.get('message', '알 수 없는 오류')}")
            
    except Exception as e:
        st.warning(f"⚠️ 백엔드 서버 연결 안내: 오프라인 모드로 작동합니다. ({e})")
        
    return None


def call_api_search_products(prompt, selected_object):
    """백엔드 유사 상품 검색 API를 호출합니다."""
    try:
        url = f"{BACKEND_URL}/api/products/search"
        payload = {
            "prompt": prompt,
            "selected_object": selected_object
        }
        res = requests.post(url, json=payload, timeout=10)
        res_data = res.json()
        if res_data.get("success"):
            return res_data.get("data", {}).get("products", [])
    except Exception as e:
        st.warning(f"⚠️ 유사 상품 추천 API 통신 실패: {e}")
    return []


def call_api_edit_furniture(image_id, coords, prompt):
    """편집 화면용 가구 인페인팅 API 호출 함수"""
    try:
        url = f"{BACKEND_URL}/api/image/edit"
        payload = {
            "image_id": image_id,
            "session_id": "room_1",
            "mask": coords,
            "selected_object": "furniture",
            "prompt": prompt
        }
        res = requests.post(url, json=payload, timeout=240)
        res_data = res.json()
        
        if res_data.get("success"):
            data = res_data.get("data", {})
            edited_url = data.get("edited_image_url")
            # ✅ None 가드: URL이 없으면 None 반환
            if not edited_url:
                st.warning("⚠️ 편집 결과 URL이 비어 있습니다.")
                return None
            result_url = BACKEND_URL + edited_url
            # ✅ 편집 후 image_id를 edit_id로 바꾸지 않음 - 원본 파일 보존
            st.session_state.last_workflow_info = data.get("workflow") or {
                "workflow": "user_masked_inpainting_workflow.json",
                "status": "loaded",
                "nodes": ["LoadImage", "LoadImageMask", "InpaintModelConditioning", "KSampler", "VAEDecode", "SaveImage"],
                "comfyui_status": "offline",
                "execution_mode": "mock_fallback"
            }
            return result_url
        else:
            st.warning(f"⚠️ 편집 API 실패: {res_data.get('message', '알 수 없는 오류')}")
    except Exception as e:
        st.warning(f"⚠️ 가구 편집 API 통신 실패: {e}")
    return None


def call_api_chat(user_message):
    """챗봇 화면용 API 호출 함수"""
    try:
        res = requests.post(f"{BACKEND_URL}/api/chat", json={"session_id": "room_1", "question": user_message}, timeout=30)
        data = res.json().get("data", {})
        return data.get("answer", "답변을 받아오지 못했습니다."), data.get("references", [])
    except Exception as e:
        return f"🏠 인테리어 AI (오프라인): '{user_message}'에 대해, 화사한 화이트 톤이나 뉴트럴 톤의 벽면 복원을 추천해 드립니다. (연결에러: {e})", []


# =========================================================
# 세션 상태 관리
# =========================================================
if "current_page" not in st.session_state:
    st.session_state.current_page = "① 입력 화면"
if "uploaded_image" not in st.session_state:
    st.session_state.uploaded_image = None
if "last_uploaded_image_id" not in st.session_state:
    st.session_state.last_uploaded_image_id = None
# ✅ 핵심 추가: 편집 전용 원본 image_id (스타일 변환 후 task UUID로 절대 덮어쓰지 않음)
if "original_upload_id" not in st.session_state:
    st.session_state.original_upload_id = None
if "selected_style" not in st.session_state:
    st.session_state.selected_style = "Custom Style"
if "result_image" not in st.session_state:
    st.session_state.result_image = None
if "edited_image" not in st.session_state:
    st.session_state.edited_image = None
if "chat_messages" not in st.session_state:
    st.session_state.chat_messages = [{"role": "assistant", "content": "안녕하세요! AI 인테리어 상담사입니다. 어떤 방을 꾸미고 싶으신가요?", "references": []}]
if "last_workflow_info" not in st.session_state:
    st.session_state.last_workflow_info = None
if "edit_points" not in st.session_state:
    st.session_state.edit_points = []
if "last_edit_prompt" not in st.session_state:
    st.session_state.last_edit_prompt = None
# ✅ dragged_coords를 세션으로 관리 → rerun() 후에도 좌표 유지
if "last_dragged_coords" not in st.session_state:
    st.session_state.last_dragged_coords = None
if "product_search_trigger" not in st.session_state:
    st.session_state.product_search_trigger = False


# =========================================================
# [사이드바 메뉴]
# =========================================================
st.sidebar.title("🏠 메뉴 탐색")
st.sidebar.write("원하시는 메뉴를 선택하세요.")

page_options = ["① 입력 화면", "② 결과 화면", "③ 편집 화면", "④ 챗봇 화면"]
selected_page = st.sidebar.radio("화면 이동", page_options, index=page_options.index(st.session_state.current_page))
st.session_state.current_page = selected_page

st.sidebar.divider()

st.sidebar.header("⚙️ 세부 옵션 설정")
strength = st.sidebar.slider("변환 강도 (Strength)", min_value=0, max_value=100, value=65)
keep_structure = st.sidebar.checkbox("기존 공간 구조 유지", value=True)
st.sidebar.caption("※ 실제 백엔드 API(FastAPI) 및 RAG 엔진과 통신 중입니다.")

if st.session_state.last_workflow_info:
    st.sidebar.divider()
    st.sidebar.subheader("⚙️ 워크플로우 실시간 상태")
    wf = st.session_state.last_workflow_info
    c_status = wf.get("comfyui_status", "offline")
    exec_mode = wf.get("execution_mode", "mock_fallback")
    status_lamp = "🟢 Online" if c_status == "online" else "🔴 Offline"
    mode_msg = "⚡ Real AI Render" if exec_mode == "real_comfyui" else "🎨 Local Mock Fallback"
    st.sidebar.info(f"📁 **Workflow:**\n`{wf.get('workflow')}`")
    st.sidebar.write(f"🔌 **ComfyUI Server:** {status_lamp}")
    st.sidebar.write(f"⚙️ **Run Mode:** {mode_msg}")
    st.sidebar.caption(f"Status: {wf.get('status')}")
    with st.sidebar.expander("실행 노드 보기"):
        for n in wf.get("nodes", []):
            st.sidebar.caption(f"✔️ {n}")


# =========================================================
# 1. 입력 화면
# =========================================================
if st.session_state.current_page == "① 입력 화면":
    st.title("📸 내 방 사진 업로드 & 스타일 선택")
    st.write("💡 **간단 설명:** 바꾸고 싶은 방이나 벽 사진을 업로드한 후, 원하는 인테리어 스타일을 설명하고 실행 버튼을 눌러보세요!")
    st.write("---")
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.subheader("1️⃣ 사진 업로드 (필수)")
        st.write("변환을 원하는 공간의 사진을 올려주세요.")
        uploaded_file = st.file_uploader("이미지 파일 선택 (JPG, PNG)", type=["jpg", "jpeg", "png"])
        
        if uploaded_file is not None:
            if st.session_state.uploaded_image != uploaded_file:
                st.session_state.uploaded_image = uploaded_file
                # 이미지 업로드 시 바로 백엔드에 전송하여 image_id 확보
                try:
                    files = {"image": ("upload.png", uploaded_file.getvalue(), "image/png")}
                    up_res = requests.post(f"{BACKEND_URL}/api/images/upload", files=files, timeout=10)
                    res_data = up_res.json()
                    if res_data.get("success"):
                        image_id = res_data.get("data", {}).get("image_id")
                        st.session_state.last_uploaded_image_id = image_id
                        st.session_state.original_upload_id = image_id
                        st.toast("💡 이미지 업로드 완료!")
                except Exception as e:
                    st.warning(f"⚠️ 백엔드 업로드 지연: {e}")
            st.image(uploaded_file, caption="✅ 업로드된 방 사진 미리보기", use_container_width=True)
        elif st.session_state.uploaded_image is not None:
            st.image(st.session_state.uploaded_image, caption="✅ 이전 업로드된 사진", use_container_width=True)
        else:
            st.info("👈 상단의 'Browse files' 버튼을 눌러 사진을 올려주세요.")
            
    with col2:
        st.subheader("2️⃣ 스타일 설명 입력")
        st.write("원하시는 방의 스타일이나 변경하고 싶은 인테리어 디자인을 직접 적어주세요.")
        
        custom_prompt = st.text_input(
            "원하는 공간 컨셉 및 인테리어 무드 설명:",
            placeholder="예: 따뜻한 우드 톤의 가구들과 아늑한 조명이 있는 북유럽풍 침실"
        )
        
        st.info("💡 **팁:** 한국어 질문도 백엔드에서 Stable Diffusion 전용 영문 프롬프트로 자동 번역되어 렌더링됩니다!")
        st.write("")
        
        if st.button("🚀 스타일 변환 실행하기", type="primary", use_container_width=True):
            if not custom_prompt:
                st.warning("⚠️ 원하시는 스타일 설명을 먼저 작성해 주세요!")
            elif st.session_state.uploaded_image is None:
                st.warning("⚠️ 사진이 없습니다! 왼쪽에서 방 사진을 먼저 업로드해 주세요.")
            else:
                with st.spinner(f"AI가 스타일에 맞춰 인테리어를 변경 중... (변환도: {strength}%)"):
                    res_img_url = call_api_transform_interior(st.session_state.uploaded_image, strength, custom_prompt, keep_structure)
                    if res_img_url:
                        st.session_state.result_image = res_img_url
                        st.session_state.selected_style = custom_prompt
                        # 편집 결과 초기화 (새 변환 시작)
                        st.session_state.edited_image = None
                        st.session_state.last_dragged_coords = None
                        st.success("🎉 인테리어 변환 성공!")
                        st.session_state.current_page = "② 결과 화면"
                        st.rerun()
                    else:
                        st.error("❌ 백엔드 처리 중 문제가 발생했습니다. 서버 상태를 확인하세요.")


# =========================================================
# 2. 결과 화면
# =========================================================
elif st.session_state.current_page == "② 결과 화면":
    st.title("✨ 인테리어 스타일 변환 결과")
    st.write(f"💡 **적용된 스타일:** `{st.session_state.selected_style}` | 원본과 AI 변환본을 비교해 보세요!")
    st.write("---")
    
    if st.session_state.result_image is None:
        st.info("💡 아직 변환된 결과가 없습니다. '① 입력 화면'에서 먼저 사진을 변환해 주세요!")
        if st.button("⬅️ 입력 화면으로 돌아가기"):
            st.session_state.current_page = "① 입력 화면"
            st.rerun()
    else:
        col_ori, col_res = st.columns(2)
        with col_ori:
            st.subheader("📷 원본 사진")
            if st.session_state.uploaded_image:
                st.image(st.session_state.uploaded_image, caption="Before", use_container_width=True)
                
        with col_res:
            st.subheader(f"🎨 AI 변환 사진")
            res_img = st.session_state.result_image
            if isinstance(res_img, str):
                cache_busted = f"{res_img}&t={int(time.time())}" if "?" in res_img else f"{res_img}?t={int(time.time())}"
                st.image(cache_busted, caption=f"After - {st.session_state.selected_style}", use_container_width=True)
            
        st.write("---")
        st.markdown("### 📊 생성 결과 요약")
        st.markdown(f"""
        - 적용 스타일: **{st.session_state.selected_style}**
        - 변환 강도: **{strength}%**
        - 공간 구조 유지: **{'적용' if keep_structure else '미적용'}**
        """)
        
        try:
            download_data = requests.get(st.session_state.result_image, timeout=5).content
        except Exception:
            download_data = st.session_state.uploaded_image.getvalue() if st.session_state.uploaded_image else b""
            
        st.download_button(
            label="📥 결과 이미지 다운로드",
            data=download_data,
            file_name="zippt_interior_result.png",
            mime="image/png"
        )
        
        st.write("---")
        btn_col1, btn_col2 = st.columns(2)
        with btn_col1:
            if st.button("🎨 특정 가구 추가 편집하기", type="primary", use_container_width=True):
                st.session_state.current_page = "③ 편집 화면"
                st.rerun()
        with btn_col2:
            if st.button("🔄 다른 스타일로 다시 변환하기", use_container_width=True):
                st.session_state.current_page = "① 입력 화면"
                st.rerun()


# =========================================================
# 3. 편집 화면
# =========================================================
elif st.session_state.current_page == "③ 편집 화면":
    st.title("🛠️ 부분 가구 편집기")
    st.write("이미지에서 수정하고 싶은 가구 영역을 마우스로 **드래그(Drag)**하여 사각형을 그려주세요.")
    
    col_img, col_tool = st.columns([1.2, 0.8])
    
    pil_img = None
    import os
    # ✅ 핵심 수정: 백엔드가 backend/ 디렉터리 기준으로 파일 저장하므로, 탐색도 backend/ 기준
    BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
    
    # ✅ 1순위: 백엔드 URL에서 직접 HTTP 다운로드 (파일경로 의존 없이 가장 안정적)
    # 편집 결과가 있으면 편집 결과를, 없으면 스타일 변환 결과를 캔버스에 표시
    display_url = st.session_state.edited_image or st.session_state.result_image
    if display_url and isinstance(display_url, str):
        try:
            from io import BytesIO
            r = requests.get(display_url, timeout=8)
            if r.status_code == 200:
                pil_img = Image.open(BytesIO(r.content)).convert("RGB")
        except Exception:
            pass
    
    # ✅ 2순위: 로컬 파일 탐색 (BACKEND_DIR 기준)
    if pil_img is None and st.session_state.original_upload_id:
        for folder in ("results", "uploads"):
            for ext in (".jpg", ".jpeg", ".png", ".webp"):
                path_candidate = os.path.join(BACKEND_DIR, folder, f"{st.session_state.original_upload_id}{ext}")
                if os.path.exists(path_candidate):
                    try:
                        pil_img = Image.open(path_candidate).convert("RGB")
                        break
                    except Exception:
                        pass
            if pil_img is not None:
                break

    # ✅ 3순위: 업로드된 원본 파일 객체
    if pil_img is None and st.session_state.uploaded_image:
        try:
            pil_img = Image.open(st.session_state.uploaded_image).convert("RGB")
        except Exception:
            pass

    # 드래그 좌표
    dragged_coords = None

    with col_img:
        st.subheader("현재 이미지 (마우스 드래그로 영역 선택)")
        if pil_img:
            w, h = pil_img.size
            aspect_ratio = w / h
            canvas_width = 700
            canvas_height = int(canvas_width / aspect_ratio)
            
            canvas_result = st_canvas(
                fill_color="rgba(255, 0, 0, 0.25)",
                stroke_width=3,
                stroke_color="#ff0000",
                background_image=pil_img,
                update_streamlit=True,
                height=canvas_height,
                width=canvas_width,
                drawing_mode="rect",
                key="canvas_edit",
            )
            
            if canvas_result.json_data is not None:
                objects = canvas_result.json_data.get("objects", [])
                if objects:
                    rect = objects[-1]
                    scale_x = w / canvas_width
                    scale_y = h / canvas_height
                    
                    rx = rect["left"] * scale_x
                    ry = rect["top"] * scale_y
                    rw = rect["width"] * rect.get("scaleX", 1.0) * scale_x
                    rh = rect["height"] * rect.get("scaleY", 1.0) * scale_y
                    
                    x_min, x_max = sorted([int(rx), int(rx + rw)])
                    y_min, y_max = sorted([int(ry), int(ry + rh)])
                    dragged_coords = [x_min, y_min, x_max, y_max]
                    # ✅ 세션에 저장 → rerun() 후에도 유지
                    st.session_state.last_dragged_coords = dragged_coords
                    
                    st.success(f"✅ 영역 지정 완료! 좌표: [{x_min}, {y_min}] ~ [{x_max}, {y_max}]")
                else:
                    # 이전 좌표 유지 (새로 드래그하기 전까지)
                    if st.session_state.last_dragged_coords:
                        dragged_coords = st.session_state.last_dragged_coords
                        x_min, y_min, x_max, y_max = dragged_coords
                        st.info(f"📍 이전 선택 영역 유지 중: [{x_min}, {y_min}] ~ [{x_max}, {y_max}]")
                    else:
                        st.info("🖱️ 이미지 위에서 마우스를 꾹 누르고 드래그하여 교체할 영역을 감싸 주세요.")
        else:
            st.info("⚠️ 편집할 이미지가 없습니다. '① 입력 화면'에서 먼저 사진을 업로드해 주세요.")
            
    with col_tool:
        st.subheader("영역 조작 및 명령어")
        st.write("※ 새 영역을 드래그하면 이전 선택이 변경됩니다.")
        st.divider()
        
        # ✅ 편집 결과 이미지 표시
        if st.session_state.edited_image:
            st.subheader("🎨 편집 결과")
            edited_url = st.session_state.edited_image
            if isinstance(edited_url, str):
                cache_busted = f"{edited_url}&t={int(time.time())}" if "?" in edited_url else f"{edited_url}?t={int(time.time())}"
                st.image(cache_busted, caption="AI 인페인팅 편집 결과", use_container_width=True)
            st.divider()
        
        st.subheader("바꿀 내용 설명")
        prompt = st.text_input("예: '침대로 바꿔줘', '하얀색 모던 소파로 변경'", value="")
        
        if st.button("✨ 편집 적용하기", type="primary", use_container_width=True):
            if not prompt:
                st.warning("설명을 입력해주세요!")
            elif st.session_state.original_upload_id is None and st.session_state.last_uploaded_image_id is None:
                st.warning("⚠️ 업로드된 이미지 ID가 없습니다. '① 입력 화면'에서 사진을 먼저 업로드해 주세요.")
            elif dragged_coords is None and st.session_state.last_dragged_coords is None:
                st.warning("⚠️ 이미지 위에서 마우스 드래그로 사각형 영역을 먼저 그려주세요!")
            else:
                effective_coords = dragged_coords or st.session_state.last_dragged_coords
                # ✅ 핵심 수정: original_upload_id 사용 (task UUID가 아닌 원본 파일명)
                edit_image_id = st.session_state.original_upload_id or st.session_state.last_uploaded_image_id
                with st.spinner("AI가 드래그한 영역을 인페인팅 중..."):
                    res_edited_url = call_api_edit_furniture(edit_image_id, effective_coords, prompt)
                    if res_edited_url:
                        st.session_state.edited_image = res_edited_url
                        st.session_state.last_edit_prompt = prompt
                        st.session_state.product_search_trigger = True
                        st.success("가구 편집 성공!")
                        st.rerun()
                    else:
                        st.error("가구 편집 연동에 실패했습니다.")
                        
        # 상품 추천 섹션
        current_query_prompt = prompt or st.session_state.last_edit_prompt
        has_active_selection = (
            dragged_coords is not None or
            st.session_state.last_dragged_coords is not None or
            st.session_state.edited_image is not None
        )
        
        st.divider()
        st.subheader("🛍️ 유사 추천 상품 정보")
        if has_active_selection and current_query_prompt:
            st.write(f"추천 기준 컨셉: **'{current_query_prompt}'**")
            # ✅ 캐싱으로 매 rerun마다 중복 API 호출 방지
            @st.cache_data(ttl=300, show_spinner=False)
            def cached_product_search(query_prompt: str, obj: str):
                return call_api_search_products(query_prompt, obj)
            
            with st.spinner("유사한 실제 가구 상품을 매칭 중..."):
                products = cached_product_search(current_query_prompt, "furniture")
                if products:
                    for p in products:
                        with st.container(border=True):
                            sub_col1, sub_col2 = st.columns([0.4, 0.6])
                            with sub_col1:
                                try:
                                    st.image(p.get("image_url"), use_container_width=True)
                                except Exception:
                                    st.write("🪑 상품 이미지")
                            with sub_col2:
                                st.markdown(f"**{p.get('product_name')}**")
                                st.write(f"💰 가격: {p.get('price')}")
                                st.caption(f"🎯 이미지 유사도: {int(p.get('similarity') * 100)}%")
                                st.markdown(f"[🔗 상품 보러가기]({p.get('purchase_link')})")
                else:
                    st.info("매칭되는 추천 상품이 없습니다.")
        else:
            st.info("💡 이미지 위를 드래그하여 영역을 지정하고 바꿀 내용(예: 소파, 침대)을 입력하시면 유사 상품이 추천됩니다!")


# =========================================================
# 4. 챗봇 화면
# =========================================================
elif st.session_state.current_page == "④ 챗봇 화면":
    st.title("💬 AI 인테리어 상담 챗봇")
    st.write("실내건축 안전 기준 및 시공 체크리스트를 기반으로 궁금한 점을 답변해 드립니다.")
    st.write("---")
    
    for msg in st.session_state.chat_messages:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])
                        
    st.write("📋 **추천 FAQ 질문 (클릭 시 자동 탐색):**")
    btn_cols = st.columns(4)
    faq_questions = [
        "인테리어 전체 공정 순서가 어떻게 돼?",
        "공사 기간 줄이는 단축 꿀팁 알려줘",
        "욕실 타일 시공 시 주의해야 할 체크포인트는?",
        "리모델링 전 동의서 및 행정 절차는 뭐가 필요해?"
    ]
    
    selected_faq = None
    for idx, q in enumerate(faq_questions):
        with btn_cols[idx]:
            if st.button(f"💬 {q.split(' ')[0]}...", key=f"faq_btn_{idx}", use_container_width=True):
                selected_faq = q

    user_input = st.chat_input("질문을 입력하세요 (예: 피난계단 디딤판 기준이 뭐야?, 방염 기준이 어떻게 돼?)")
    query_to_send = selected_faq or user_input
    
    if query_to_send:
        st.session_state.chat_messages.append({"role": "user", "content": query_to_send, "references": []})
        with st.chat_message("user"):
            st.write(query_to_send)
            
        with st.chat_message("assistant"):
            with st.spinner("RAG 문헌 탐색 및 답변 생성 중..."):
                reply, references = call_api_chat(query_to_send)
                st.write(reply)
                            
        st.session_state.chat_messages.append({
            "role": "assistant",
            "content": reply,
            "references": references
        })
        st.rerun()
