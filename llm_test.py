# ==============================================================================
# Gemini API 테스트 스크립트 (최신 google-genai SDK 적용 버전)
# ==============================================================================
# 비유하자면, 이 스크립트는 '말끝마다 ㅋㅋㅋㅋㅋㅋㅋ를 붙여야 하는 유쾌한 인공지능 배우'에게
# 최신 대본(시스템 프롬프트)을 주고, 관객(사용자)의 질문에 실시간으로 대답하도록 시키는 프로그램입니다!

import os
import sys

# 윈도우 터미널(cp949) 환경에서도 한글 출력이 깨지지 않도록 인코딩을 맞춥니다.
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

# 1. 환경변수(.env 파일) 로딩을 위한 라이브러리 불러오기
try:
    from dotenv import load_dotenv
except ImportError:
    print("[오류] 'python-dotenv' 패키지가 설치되어 있지 않습니다.")
    print("-> 해결 방법: pip install python-dotenv")
    sys.exit(1)

# 2. 구글의 최신 공식 Gemini API 라이브러리 불러오기
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("[오류] 구글의 최신 'google-genai' 패키지가 설치되어 있지 않습니다.")
    print("-> 해결 방법: 터미널에 아래 명령어를 입력하여 설치해주세요.")
    print("   pip install google-genai")
    sys.exit(1)


def main():
    # --------------------------------------------------------------------------
    # 단계 1: .env 파일에서 GEMINI_API_KEY 불러오기 (비밀 출입증 챙기기)
    # --------------------------------------------------------------------------
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    
    # 열쇠(API Key)가 없다면 사용자가 쉽게 따라 할 수 있는 해결책을 안내합니다.
    if not api_key:
        print("\n" + "="*65)
        print("[오류] .env 파일에서 'GEMINI_API_KEY'를 찾을 수 없습니다!")
        print("="*65)
        print("👉 [해결 방법]:")
        print("1. 현재 프로젝트 폴더(c:\\Users\\USER\\Documents\\project1) 안에")
        print("   '.env' 라는 이름의 메모장 파일을 만드세요.")
        print("2. 파일 내용에 아래와 같이 본인의 구글 API 키를 적고 저장하세요.")
        print("   GEMINI_API_KEY=AIzaSy...")
        print("="*65 + "\n")
        return

    # 최신 클라이언트 객체를 생성하여 안전하게 인증을 마칩니다.
    client = genai.Client(api_key=api_key)

    # --------------------------------------------------------------------------
    # 단계 2: 페르소나 설정 및 환경 구성하기 (배우 캐릭터 설정)
    # --------------------------------------------------------------------------
    persona_instruction = (
        "너는 대답할 때마다 무조건 문장의 맨 끝에 'ㅋㅋㅋㅋㅋㅋㅋ'를 붙여서 대답하는 유쾌한 페르소나야. "
        "어떤 진지하거나 어려운 질문이 들어와도 답변을 해주되, 끝에는 반드시 'ㅋㅋㅋㅋㅋㅋㅋ'를 붙여야 해."
    )

    # 최신 SDK 규격에 맞게 시스템 프롬프트 설정값(Config)을 포장합니다.
    config = types.GenerateContentConfig(
        system_instruction=persona_instruction,
    )

    model_name = "gemini-2.5-flash"
    print(f"[안내] 최신 구글 SDK로 Gemini 모델({model_name}) 준비 완료!")

    # --------------------------------------------------------------------------
    # 단계 3: 실시간 사용자 입력 받기 (관객과의 대화 창구)
    # --------------------------------------------------------------------------
    print("\n[준비 완료!] Gemini에게 물어볼 질문을 입력해보세요.")
    print("(프로그램을 종료하시려면 'quit', 'exit' 또는 '종료'를 입력하세요)")
    print("-" * 65)

    while True:
        try:
            user_input = input("\n[사용자 질문 입력]: ").strip()
            
            if not user_input:
                continue
                
            if user_input.lower() in ['quit', 'exit', '종료']:
                print("\n[안내] 대화를 종료합니다. 좋은 하루 보내세요! ㅋㅋㅋㅋㅋㅋㅋ")
                break

            print("[안내] Gemini가 열심히 답변을 생각하는 중입니다...")
            
            # ------------------------------------------------------------------
            # 단계 4: 최신 API 실행 및 결과 출력
            # ------------------------------------------------------------------
            # 최신 문법인 client.models.generate_content 를 사용하여 답변을 받습니다.
            response = client.models.generate_content(
                model=model_name,
                contents=user_input,
                config=config,
            )
            
            print(f"\n[Gemini 답변]:\n{response.text}")
            print("-" * 65)

        except KeyboardInterrupt:
            print("\n\n[안내] 강제 종료되었습니다. 프로그램을 종료합니다.")
            break
        except Exception as e:
            print(f"\n[오류 발생] API 호출 중 문제가 생겼습니다.\n원인: {e}")
            print("-> 해결 방법: API 키 권한이나 인터넷 연결 상태를 확인해주세요.")


if __name__ == "__main__":
    main()
