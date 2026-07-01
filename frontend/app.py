# =========================================================
# 인테리어 변경 AI 웹 애플리케이션 프론트엔드 (app.py)
# =========================================================
import streamlit as st
import time
import requests
from PIL import Image

# 웹 페이지 탭 제목과 아이콘 설정
st.set_page_config(page_title="AI 인테리어 스튜디오", page_icon="🏠", layout="wide")

BACKEND_URL = "http://127.0.0.1:8000"

# =========================================================
# 백엔드 API 호출 함수들
# =========================================================
def request_image_generation(image_id, style, strength, prompt):
    """백엔드에 이미지 생성/스타일 변환을 요청합니다."""
    url = f"{BACKEND_URL}/api/image/generate"
    payload = {
        "session_id": "room_1",
        "image_id": image_id,
        "style": style,
        "strength": float(strength),
        "prompt": prompt
    }
    response = requests.post(url, json=payload, timeout=60)
    return response.json()


def call_api_transform_interior(image_file, style, strength, keep_structure):
    """입력 화면에서 '변환하기' 버튼을 눌렀을 때 호출되는 메인 처리 함수"""
    try:
        # 1단계: 백엔드 이미지 업로드
        files = {"image": ("upload.png", image_file.getvalue(), "image/png")}
        up_res = requests.post(f"{BACKEND_URL}/api/images/upload", files=files, timeout=5)
        res_data = up_res.json()
        
        if not res_data.get("success"):
            st.error(f"이미지 업로드 실패: {res_data.get('message')}")
            return None
            
        image_id = res_data.get("data", {}).get("image_id")
        st.session_state.last_uploaded_image_id = image_id
        
        # 2단계: 스타일 변환 수행
        # 스타일이 Anti-graffiti Clean인 경우 낙서 제거 API 호출, 그 외엔 일반 이미지 생성 API 호출
        if style == "Anti-graffiti Clean":
            url = f"{BACKEND_URL}/api/graffiti/remove"
            payload = {
                "image_id": image_id,
                "session_id": "room_1",
                "mode": "auto",
                "prompt": "Remove graffiti and restore clean wall surface"
            }
            api_res = requests.post(url, json=payload, timeout=60)
            res_json = api_res.json()
            
            if res_json.get("success"):
                data = res_json.get("data", {})
                result_url = BACKEND_URL + data.get("result_image_url")
                # 워크플로우 실시간 상태 기록
                st.session_state.last_workflow_info = data.get("workflow") or {
                    "workflow": "user_masked_inpainting_workflow.json",
                    "status": "loaded",
                    "nodes": ["LoadImage", "MaskImage", "SAMDetector", "SEGSDetailer", "KSampler", "SaveImage"],
                    "comfyui_status": "offline",
                    "execution_mode": "mock_fallback"
                }
                st.toast("✅ 낙서 제거 백엔드 통신 성공!")
                return result_url
        else:
            prompt_map = {
                "Urban Minimal": "A minimal modern urban living room, tidy and sleek style, high resolution",
                "Neutral Wall Restore": "A cozy neutral toned bedroom wall with wooden furniture and warm lights",
                "Gallery White": "A bright gallery white spacious studio room, minimalist decor, artistic setup"
            }
            prompt = prompt_map.get(style, "Beautiful interior redesign")
            
            api_result = request_image_generation(image_id, style, strength, prompt)
            
            if api_result.get("success"):
                data = api_result.get("data", {})
                result_url = BACKEND_URL + data.get("generated_image_url")
                
                # 워크플로우 시뮬레이션 정보 세션에 저장
                st.session_state.last_workflow_info = data.get("workflow") or {
                    "workflow": "room_redesign_workflow.json",
                    "status": "loaded",
                    "nodes": ["LoadImage", "ControlNetLoader", "PromptCLIPEncode", "KSampler", "VAEDecode", "SaveImage"],
                    "comfyui_status": "offline",
                    "execution_mode": "mock_fallback"
                }
                st.toast(f"✅ 백엔드 스타일 변환 통신 성공!")
                return result_url
                
    except Exception as e:
        st.warning(f"⚠️ 백엔드 서버 연결 안내: 오프라인 모드로 작동합니다. ({e})")
        
    return None


def call_api_edit_furniture(image_id, coords, prompt):
    """편집 화면용 API 호출 함수"""
    try:
        url = f"{BACKEND_URL}/api/image/edit"
        payload = {
            "image_id": image_id,
            "session_id": "room_1",
            "mask": coords,
            "selected_object": "furniture",
            "prompt": prompt
        }
        res = requests.post(url, json=payload, timeout=60)
        res_data = res.json()
        
        if res_data.get("success"):
            data = res_data.get("data", {})
            result_url = BACKEND_URL + data.get("edited_image_url")
            st.session_state.last_workflow_info = data.get("workflow") or {
                "workflow": "furniture_inpainting_workflow.json",
                "status": "loaded",
                "nodes": ["LoadImage", "BboxDetectorSEGS", "SAMModelLoader", "SEGSDetailer", "InpaintModelApply", "SaveImage"],
                "comfyui_status": "offline",
                "execution_mode": "mock_fallback"
            }
            return result_url
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
if "selected_style" not in st.session_state:
    st.session_state.selected_style = "Anti-graffiti Clean"
if "result_image" not in st.session_state:
    st.session_state.result_image = None
if "edited_image" not in st.session_state:
    st.session_state.edited_image = None
if "chat_messages" not in st.session_state:
    st.session_state.chat_messages = [{"role": "assistant", "content": "안녕하세요! AI 인테리어 상담사입니다. 어떤 방을 꾸미고 싶으신가요?", "references": []}]
if "last_workflow_info" not in st.session_state:
    st.session_state.last_workflow_info = None


# =========================================================
# [사이드바 메뉴] 화면 왼쪽 내비게이션 바 & 세부 옵션
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

# 사이드바 하단에 실시간 ComfyUI 실행 모니터링 출력
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
    st.write("💡 **간단 설명:** 바꾸고 싶은 방이나 벽 사진을 업로드한 후, 원하는 인테리어 재생 스타일을 선택하고 실행 버튼을 눌러보세요!")
    st.write("---")
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.subheader("1️⃣ 사진 업로드 (필수 요소)")
        st.write("변환을 원하는 공간의 사진을 올려주세요.")
        uploaded_file = st.file_uploader("이미지 파일 선택 (JPG, PNG)", type=["jpg", "jpeg", "png"])
        
        if uploaded_file is not None:
            st.session_state.uploaded_image = uploaded_file
            st.image(uploaded_file, caption="✅ 업로드된 방 사진 미리보기", use_container_width=True)
        elif st.session_state.uploaded_image is not None:
            st.image(st.session_state.uploaded_image, caption="✅ 이전 업로드된 사진", use_container_width=True)
        else:
            st.info("👈 상단의 'Browse files' 버튼을 눌러 사진을 올려주세요.")
            
    with col2:
        st.subheader("2️⃣ 변환 스타일 선택 (필수 요소)")
        st.write("공간을 새롭게 재탄생시킬 무드를 선택해 주세요.")
        
        style_list = [
            "Anti-graffiti Clean",
            "Urban Minimal",
            "Neutral Wall Restore",
            "Gallery White"
        ]
        
        chosen_style = st.radio(
            "인테리어 변환 옵션:",
            style_list,
            index=style_list.index(st.session_state.selected_style) if st.session_state.selected_style in style_list else 0
        )
        st.session_state.selected_style = chosen_style
        
        st.write("📌 **선택하신 스타일 설명:**")
        if chosen_style == "Anti-graffiti Clean":
            st.info("🧼 **Anti-graffiti Clean**: 벽면의 낙서나 얼룩을 깔끔하게 지우고 깨끗한 원상태로 복원합니다. [user_masked_inpainting_workflow.json]")
        elif chosen_style == "Urban Minimal":
            st.info("🏙️ **Urban Minimal**: 도시적인 감성의 불필요한 장식을 배제한 세련되고 심플한 미니멀 공간을 연출합니다. [room_redesign_workflow.json]")
        elif chosen_style == "Neutral Wall Restore":
            st.info("🌿 **Neutral Wall Restore**: 차분하고 따뜻한 뉴트럴 톤으로 편안하게 벽면을 재생합니다. [room_redesign_workflow.json]")
        elif chosen_style == "Gallery White":
            st.info("🤍 **Gallery White**: 미술관 갤러리처럼 화사하고 넓어 보이는 밝은 순백색 톤으로 공간을 탈바꿈합니다. [room_redesign_workflow.json]")
            
        st.write("")
        
        if st.button("🚀 선택한 스타일로 변환 실행하기", type="primary", use_container_width=True):
            if st.session_state.uploaded_image is None:
                st.warning("⚠️ 사진이 없습니다! 왼쪽에서 방 사진을 먼저 업로드해 주세요.")
            else:
                with st.spinner(f"AI가 '{chosen_style}' (강도: {strength}%) 스타일로 변환 중입니다..."):
                    res_img_url = call_api_transform_interior(st.session_state.uploaded_image, chosen_style, strength, keep_structure)
                    if res_img_url:
                        st.session_state.result_image = res_img_url
                        st.success("🎉 인테리어 변환 성공!")
                        st.session_state.current_page = "② 결과 화면"
                        st.rerun()
                    else:
                        st.error("❌ 백엔드 처리 중 문제가 발생하여 데모 이미지로 대체하지 못했습니다. 서버 상태를 확인하세요.")


# =========================================================
# 2. 결과 화면
# =========================================================
elif st.session_state.current_page == "② 결과 화면":
    st.title("✨ 인테리어 스타일 변환 결과")
    st.write(f"💡 **적용된 스타일:** `{st.session_state.selected_style}` | 좌우로 원본과 AI 변환본을 비교해 보세요!")
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
            st.image(st.session_state.uploaded_image, caption="Before", use_container_width=True)
                
        with col_res:
            st.subheader(f"🎨 AI 변환 사진 ({st.session_state.selected_style})")
            st.image(st.session_state.result_image, caption=f"After - {st.session_state.selected_style}", use_container_width=True)
            
        st.write("---")
        
        st.markdown("### 📊 생성 결과 요약")
        st.markdown(f"""
        - 적용 스타일: **{st.session_state.selected_style}**
        - 변환 강도: **{strength}%**
        - 공간 구조 유지: **{'적용' if keep_structure else '미적용'}**
        - 통신 상태: **백엔드 API 및 실시간 모킹 엔진 작동 완료**
        """)
        
        # 실제 변환본 다운로드 지원
        try:
            download_data = requests.get(st.session_state.result_image).content
        except:
            download_data = st.session_state.uploaded_image.getvalue()
            
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
    st.write("이미지에서 수정하고 싶은 영역의 좌표를 설정하고, 바꾸고 싶은 내용을 적어주세요. [furniture_inpainting_workflow.json]")
    
    col_img, col_tool = st.columns([1, 1])
    with col_img:
        st.subheader("현재 이미지")
        current_img = st.session_state.edited_image or st.session_state.result_image or st.session_state.uploaded_image
        if current_img:
            st.image(current_img, use_container_width=True)
        else:
            st.info("이미지가 없습니다.")
            
    with col_tool:
        st.subheader("1. 영역 선택 좌표 (BBox 지정)")
        c1, c2 = st.columns(2)
        with c1:
            sx = st.number_input("시작 X 좌표", value=100)
            sy = st.number_input("시작 Y 좌표", value=150)
        with c2:
            w = st.number_input("너비", value=200)
            h = st.number_input("높이", value=250)
            
        st.subheader("2. 바꿀 내용 설명")
        prompt = st.text_input("예: '소파를 하얀색으로 바꿔줘'")
        if st.button("✨ 편집 적용하기", type="primary", use_container_width=True):
            if not prompt:
                st.warning("설명을 입력해주세요!")
            elif st.session_state.last_uploaded_image_id is None:
                st.warning("⚠️ 업로드된 이미지 ID가 없습니다. '① 입력 화면'에서 먼저 사진을 업로드 및 스타일 변환해 주세요.")
            else:
                with st.spinner("AI가 가구 부분 편집 및 교체 중..."):
                    coords = [int(sx), int(sy), int(sx + w), int(sy + h)]
                    res_edited_url = call_api_edit_furniture(st.session_state.last_uploaded_image_id, coords, prompt)
                    if res_edited_url:
                        st.session_state.edited_image = res_edited_url
                        st.success("완료!")
                        st.rerun()
                    else:
                        st.error("가구 편집 연동에 실패했습니다.")


# =========================================================
# 4. 챗봇 화면
# =========================================================
elif st.session_state.current_page == "④ 챗봇 화면":
    st.title("💬 AI 인테리어 상담 챗봇")
    st.write("실내건축 안전 기준 고시 및 시공 체크리스트를 기반으로 궁금한 점을 답변해 드립니다.")
    st.write("---")
    
    for msg in st.session_state.chat_messages:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])
            if msg.get("references"):
                with st.expander("📚 답변의 신뢰도 및 참고 근거 확인"):
                    for ref in msg["references"]:
                        st.write(f"- {ref}")
                        
    # 자주 묻는 질문 RAG 퀵 링크 버튼 배치 (FAQ.py 및 ingest.py에 정의된 지식 연동)
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
                if references:
                    with st.expander("📚 답변의 신뢰도 및 참고 근거 확인"):
                        for ref in references:
                            st.write(f"- {ref}")
                            
        st.session_state.chat_messages.append({
            "role": "assistant",
            "content": reply,
            "references": references
        })
        st.rerun()
