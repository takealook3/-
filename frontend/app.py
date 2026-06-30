# =========================================================
# 인테리어 변경 AI 웹 애플리케이션 프론트엔드 (app.py)
# =========================================================
# Streamlit 프레임워크를 사용하여 UI 화면을 구성합니다.
# 실행 방법: 터미널에서 `streamlit run frontend/app.py` 명령어 입력

import streamlit as st
import time

# 웹 페이지 탭 제목과 아이콘 설정
st.set_page_config(page_title="AI 인테리어 스튜디오", page_icon="🏠", layout="wide")

# =========================================================
# [API 연결 준비 구역] 나중에 백엔드 서버와 통신할 함수들
# =========================================================
# 지금은 서버가 없으므로 임시(더미) 데이터와 이미지를 돌려줍니다.

def call_api_transform_interior(image_file, style):
    """
    ① 입력 화면에서 '변환하기' 버튼을 눌렀을 때 호출되는 함수입니다.
    나중에 여기에 백엔드 API (예: requests.post) 요청 코드를 넣으면 됩니다.
    """
    # 1초 정도 로딩되는 척(분위기 연출)
    time.sleep(1)
    # 스타일별로 다른 더미 이미지 URL을 리턴합니다.
    return f"https://picsum.photos/800/600?random=1"

def call_api_edit_furniture(image_url, coords, prompt):
    """
    ③ 편집 화면에서 '적용하기' 버튼을 눌렀을 때 호출되는 함수입니다.
    선택한 좌표(coords)와 가구 설명(prompt)을 백엔드로 보내는 역할을 합니다.
    """
    time.sleep(1)
    # 편집된 척 새로운 더미 이미지 URL을 리턴합니다.
    return f"https://picsum.photos/800/600?random=2"

def call_api_chat(user_message):
    """
    ④ 챗봇 화면에서 메시지를 입력했을 때 AI 답변을 받아오는 함수입니다.
    """
    time.sleep(0.5)
    return f"🏠 인테리어 AI: '{user_message}'에 대한 인테리어 팁을 안내해 드릴게요! 화분이나 따뜻한 조명을 추가해보시면 어떨까요?"


# =========================================================
# [세션 상태 관리] 화면 간 데이터나 현재 페이지를 기억하는 공간
# =========================================================
# 페이지를 새로고침해도 데이터가 날아가지 않도록 st.session_state에 저장합니다.

if "current_page" not in st.session_state:
    st.session_state.current_page = "① 입력 화면"
if "uploaded_image" not in st.session_state:
    st.session_state.uploaded_image = None
if "result_image_url" not in st.session_state:
    st.session_state.result_image_url = None
if "edited_image_url" not in st.session_state:
    st.session_state.edited_image_url = None
if "chat_messages" not in st.session_state:
    # 챗봇 첫 인사말 저장
    st.session_state.chat_messages = [{"role": "assistant", "content": "안녕하세요! AI 인테리어 상담사입니다. 어떤 방을 꾸미고 싶으신가요?"}]


# =========================================================
# [사이드바 메뉴] 화면 왼쪽 메뉴바 구성
# =========================================================
st.sidebar.title("🏠 메뉴 탐색")
st.sidebar.write("원하시는 메뉴를 선택하세요.")

page_options = ["① 입력 화면", "② 결과 화면", "③ 편집 화면", "④ 챗봇 화면"]
# 버튼 조작으로 페이지 이동이 가능하도록 세션 상태와 연동합니다.
selected_page = st.sidebar.radio("화면 이동", page_options, index=page_options.index(st.session_state.current_page))
st.session_state.current_page = selected_page


# =========================================================
# 1. 입력 화면: 사진 업로드 및 스타일 선택
# =========================================================
if st.session_state.current_page == "① 입력 화면":
    st.title("📸 내 방 사진 업로드 & 스타일 선택")
    st.write("바꾸고 싶은 방 사진을 올리고 원하는 인테리어 스타일을 골라보세요!")
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.subheader("1. 사진 업로드")
        uploaded_file = st.file_uploader("이미지 파일을 선택해주세요 (JPG, PNG)", type=["jpg", "jpeg", "png"])
        if uploaded_file is not None:
            st.session_state.uploaded_image = uploaded_file
            st.image(uploaded_file, caption="업로드된 내 방 사진", use_container_width=True)
        elif st.session_state.uploaded_image is not None:
            st.image(st.session_state.uploaded_image, caption="이전 업로드된 사진", use_container_width=True)
            
    with col2:
        st.subheader("2. 인테리어 스타일 선택")
        selected_style = st.radio(
            "원하시는 무드를 선택하세요:",
            ["✨ 모던 (Sleek & Modern)", "🌿 내추럴 (Warm & Natural)", "📜 빈티지 (Classic Vintage)", "🤍 미니멀 (Minimalist)"]
        )
        st.write("") # 여백
        
        # 변환하기 버튼
        if st.button("🚀 변환하기", type="primary", use_container_width=True):
            if st.session_state.uploaded_image is None:
                st.warning("⚠️ 먼저 왼쪽에서 방 사진을 업로드해주세요!")
            else:
                with st.spinner("AI가 멋진 인테리어를 디자인하는 중입니다..."):
                    # 분리해둔 API 호출 함수 실행!
                    new_image_url = call_api_transform_interior(st.session_state.uploaded_image, selected_style)
                    st.session_state.result_image_url = new_image_url
                    st.success("🎉 변환 완료!")
                    # 결과 화면으로 자동 이동
                    st.session_state.current_page = "② 결과 화면"
                    st.rerun()


# =========================================================
# 2. 결과 화면: 원본과 변환본 비교
# =========================================================
elif st.session_state.current_page == "② 결과 화면":
    st.title("✨ 인테리어 변환 결과")
    
    if st.session_state.result_image_url is None:
        st.info("💡 아직 변환된 결과가 없습니다. '① 입력 화면'에서 먼저 사진을 변환해주세요!")
        if st.button("⬅️ 입력 화면으로 가기"):
            st.session_state.current_page = "① 입력 화면"
            st.rerun()
    else:
        st.write("좌우로 비교해보세요! 마음에 들지 않는 부분은 가구 편집기로 고칠 수 있습니다.")
        
        # 2개 컬럼으로 원본과 결과물 나란히 배치
        col_ori, col_res = st.columns(2)
        with col_ori:
            st.subheader("📷 원본 사진")
            if st.session_state.uploaded_image:
                st.image(st.session_state.uploaded_image, use_container_width=True)
            else:
                st.image("https://picsum.photos/800/600?random=99", caption="임시 원본 사진", use_container_width=True)
                
        with col_res:
            st.subheader("🎨 AI 변환 사진")
            st.image(st.session_state.result_image_url, use_container_width=True)
            
        st.write("---")
        
        # 하단 조작 버튼들
        btn_col1, btn_col2 = st.columns(2)
        with btn_col1:
            if st.button("🎨 특정 가구 편집하기", type="primary", use_container_width=True):
                st.session_state.current_page = "③ 편집 화면"
                st.rerun()
        with btn_col2:
            if st.button("🔄 다른 스타일로 다시 변환", use_container_width=True):
                st.session_state.current_page = "① 입력 화면"
                st.rerun()


# =========================================================
# 3. 편집 화면: 영역 선택 및 가구 교체
# =========================================================
elif st.session_state.current_page == "③ 편집 화면":
    st.title("🛠️ 부분 가구 편집기")
    st.write("이미지에서 수정하고 싶은 가구 영역의 좌표를 정하고, 어떻게 바꿀지 설명해주세요.")
    
    col_img, col_tool = st.columns([1, 1])
    
    with col_img:
        st.subheader("편집 대상 이미지")
        current_img = st.session_state.edited_image_url or st.session_state.result_image_url
        if current_img:
            st.image(current_img, caption="현재 인테리어 이미지", use_container_width=True)
        else:
            st.image("https://picsum.photos/800/600?random=10", caption="임시 기준 이미지", use_container_width=True)
            
    with col_tool:
        st.subheader("1. 영역 선택 (좌표 입력)")
        st.write("바꾸고 싶은 가구가 있는 네모 박스 영역을 설정하세요.")
        coord_col1, coord_col2 = st.columns(2)
        with coord_col1:
            start_x = st.number_input("시작 X 좌표", min_value=0, max_value=1000, value=100)
            start_y = st.number_input("시작 Y 좌표", min_value=0, max_value=1000, value=150)
        with coord_col2:
            width = st.number_input("너비 (Width)", min_value=10, max_value=1000, value=200)
            height = st.number_input("높이 (Height)", min_value=10, max_value=1000, value=250)
            
        st.subheader("2. 바꿀 가구 설명 입력")
        furniture_prompt = st.text_input("예: '갈색 가죽 소파를 하얀색 패브릭 소파로 바꿔줘'")
        
        st.write("") # 여백
        if st.button("✨ 편집 적용하기", type="primary", use_container_width=True):
            if not furniture_prompt:
                st.warning("⚠️ 바꿀 가구에 대한 설명을 입력해주세요!")
            else:
                with st.spinner("AI가 선택하신 영역의 가구를 교체 중입니다..."):
                    coords = {"x": start_x, "y": start_y, "w": width, "h": height}
                    # 분리해둔 편집 API 호출 함수 실행!
                    new_edited_url = call_api_edit_furniture(current_img, coords, furniture_prompt)
                    st.session_state.edited_image_url = new_edited_url
                    st.success("🎉 가구 교체 완료!")
                    st.rerun()


# =========================================================
# 4. 챗봇 화면: 인테리어 AI 상담
# =========================================================
elif st.session_state.current_page == "④ 챗봇 화면":
    st.title("💬 AI 인테리어 상담 챗봇")
    st.write("인테리어 비용, 가구 배치, 색상 조합 등 궁금한 점을 편하게 물어보세요!")
    
    # 이전 대화 내용들을 화면에 차례대로 출력합니다.
    for msg in st.session_state.chat_messages:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])
            
    # 사용자 입력 창 (화면 맨 아래쪽에 고정됨)
    user_input = st.chat_input("질문을 입력하세요 (예: 좁은 방을 넓어 보이게 하려면?)")
    
    if user_input:
        # 1. 사용자가 쓴 메시지를 화면과 세션에 추가
        st.session_state.chat_messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.write(user_input)
            
        # 2. AI 챗봇 API 호출 및 답변 표시
        with st.chat_message("assistant"):
            with st.spinner("AI 상담사가 답변을 생각 중입니다..."):
                ai_reply = call_api_chat(user_input)
                st.write(ai_reply)
        st.session_state.chat_messages.append({"role": "assistant", "content": ai_reply})
