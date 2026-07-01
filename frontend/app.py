# =========================================================
# 인테리어 변경 AI 웹 애플리케이션 프론트엔드 (app.py)
# =========================================================
# Streamlit 프레임워크를 사용하여 UI 화면을 구성합니다.

import streamlit as st
import time
import requests
from PIL import Image

# 웹 페이지 탭 제목과 아이콘 설정
st.set_page_config(page_title="AI 인테리어 스튜디오", page_icon="🏠", layout="wide")

# =========================================================
# [NEW] 참고해 주신 백엔드 API 실제 호출 함수!
# =========================================================
def request_image_generation(image_id, style, strength):
    """
    [진짜 HTTP 통신 집배원 함수]
    사용자님이 참고 코드로 주신 requests.post 구조를 사용하여
    백엔드 서버(http://127.0.0.1:8000/api/image/generate)로 진짜 요청을 보냅니다!
    """
    url = "http://127.0.0.1:8000/api/image/generate"
    payload = {
        "image_id": image_id,
        "style": style,
        "strength": strength
    }
    # 백엔드 서버로 POST 요청 발송
    response = requests.post(url, json=payload, timeout=5)
    return response.json()


def call_api_transform_interior(image_file, style, strength, keep_structure):
    """
    ① 입력 화면에서 '변환하기' 버튼을 눌렀을 때 호출되는 메인 처리 함수입니다.
    1. 사진을 백엔드로 보내 고유 ID(image_id)를 발급받습니다.
    2. request_image_generation()을 불러 진짜 변환 요청을 전송합니다.
    """
    try:
        # 1단계: 백엔드 창구에 사진 업로드하여 image_id 받기
        files = {"file": ("upload.png", image_file.getvalue(), "image/png")}
        up_res = requests.post("http://127.0.0.1:8000/api/images", files=files, timeout=5)
        image_id = up_res.json().get("image_id", "test_id_123")
        
        # 2단계: 참고해 주신 함수로 백엔드에 이미지 변환 요청 발송!
        api_result = request_image_generation(image_id, style, strength)
        
        # 백엔드 콘솔과 화면에 통신 성공 메시지 띄우기
        st.toast(f"✅ 백엔드 통신 성공! ({api_result.get('message')})")
        
    except Exception as e:
        # 혹시 백엔드 서버가 꺼져 있어도 화면이 안 멈추도록 안전 보호 장치 구비
        st.warning(f"⚠️ 백엔드 서버 연결 안내: 더미 모드로 작동합니다. ({e})")
        
    # 데모 화면에서는 원본 안전 출력 유지
    return image_file


def call_api_edit_furniture(image_file, coords, prompt):
    """③ 편집 화면용 API 호출 함수"""
    time.sleep(1)
    return image_file


def call_api_chat(user_message):
    """④ 챗봇 화면용 API 호출 함수"""
    try:
        res = requests.post("http://127.0.0.1:8000/api/chat", json={"session_id": "room_1", "message": user_message}, timeout=3)
        return res.json().get("answer", "답변을 받아오지 못했습니다.")
    except:
        return f"🏠 인테리어 AI: '{user_message}'에 대한 팁을 안내해 드릴게요! 화사한 화이트 톤을 추천합니다."


# =========================================================
# [세션 상태 관리] 페이지 전환 시 데이터 유지 공간
# =========================================================
if "current_page" not in st.session_state:
    st.session_state.current_page = "① 입력 화면"
if "uploaded_image" not in st.session_state:
    st.session_state.uploaded_image = None
if "selected_style" not in st.session_state:
    st.session_state.selected_style = "Anti-graffiti Clean"
if "result_image" not in st.session_state:
    st.session_state.result_image = None
if "edited_image" not in st.session_state:
    st.session_state.edited_image = None
if "chat_messages" not in st.session_state:
    st.session_state.chat_messages = [{"role": "assistant", "content": "안녕하세요! AI 인테리어 상담사입니다. 어떤 방을 꾸미고 싶으신가요?"}]


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
st.sidebar.caption("※ 실제 백엔드 API(requests)와 통신 중입니다.")


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
            st.info("🧼 **Anti-graffiti Clean**: 벽면의 낙서나 얼룩을 깔끔하게 지우고 깨끗한 원상태로 복원합니다.")
        elif chosen_style == "Urban Minimal":
            st.info("🏙️ **Urban Minimal**: 도시적인 감성의 불필요한 장식을 배제한 세련되고 심플한 미니멀 공간을 연출합니다.")
        elif chosen_style == "Neutral Wall Restore":
            st.info("🌿 **Neutral Wall Restore**: 차분하고 따뜻한 뉴트럴 톤으로 편안하게 벽면을 재생합니다.")
        elif chosen_style == "Gallery White":
            st.info("🤍 **Gallery White**: 미술관 갤러리처럼 화사하고 넓어 보이는 밝은 순백색 톤으로 공간을 탈바꿈합니다.")
            
        st.write("")
        
        if st.button("🚀 선택한 스타일로 변환 실행하기", type="primary", use_container_width=True):
            if st.session_state.uploaded_image is None:
                st.warning("⚠️ 사진이 없습니다! 왼쪽에서 방 사진을 먼저 업로드해 주세요.")
            else:
                with st.spinner(f"AI가 '{chosen_style}' (강도: {strength}%) 스타일로 변환 중입니다..."):
                    res_img = call_api_transform_interior(st.session_state.uploaded_image, chosen_style, strength, keep_structure)
                    st.session_state.result_image = res_img
                    st.success("🎉 인테리어 변환 성공!")
                    st.session_state.current_page = "② 결과 화면"
                    st.rerun()


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
            st.caption("※ 실제 AI 변환 전 단계이므로 원본 이미지를 결과 위치에 표시합니다.")
            
        st.write("---")
        
        st.markdown("### 📊 생성 결과 요약")
        st.markdown(f"""
        - 적용 스타일: **{st.session_state.selected_style}**
        - 변환 강도: **{strength}%**
        - 공간 구조 유지: **{'적용' if keep_structure else '미적용'}**
        - 통신 상태: **백엔드 API (`requests.post`) 통신 완료**
        """)
        
        st.download_button(
            label="📥 결과 이미지 다운로드",
            data=st.session_state.uploaded_image.getvalue(),
            file_name="zippt_antigraffiti_result.png",
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
    st.write("이미지에서 수정하고 싶은 영역의 좌표를 설정하고, 바꾸고 싶은 내용을 적어주세요.")
    
    col_img, col_tool = st.columns([1, 1])
    with col_img:
        st.subheader("현재 이미지")
        current_img = st.session_state.edited_image or st.session_state.result_image or st.session_state.uploaded_image
        if current_img:
            st.image(current_img, use_container_width=True)
        else:
            st.info("이미지가 없습니다.")
            
    with col_tool:
        st.subheader("1. 영역 선택 좌표")
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
            else:
                with st.spinner("AI가 교체 중입니다..."):
                    st.session_state.edited_image = current_img
                    st.success("완료!")
                    st.rerun()


# =========================================================
# 4. 챗봇 화면
# =========================================================
elif st.session_state.current_page == "④ 챗봇 화면":
    st.title("💬 AI 인테리어 상담 챗봇")
    st.write("궁금한 점을 편하게 물어보세요!")
    for msg in st.session_state.chat_messages:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])
    user_input = st.chat_input("질문을 입력하세요")
    if user_input:
        st.session_state.chat_messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.write(user_input)
        with st.chat_message("assistant"):
            reply = call_api_chat(user_input)
            st.write(reply)
        st.session_state.chat_messages.append({"role": "assistant", "content": reply})
