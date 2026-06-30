# ==============================================================================
# Ollama(올라마) 로컬 AI 모델(qwen3.5:0.8b) 추론 API 테스트 스크립트
# ==============================================================================
# 비유하자면, 내 컴퓨터 안에서 살고 있는 인공지능 비서(Ollama)에게
# 우체국 택배(requests)를 보내 질문을 던지고 답변을 받아오는 프로그램입니다!

import sys
import json

# 1. 우체국 택배 역할을 하는 requests 라이브러리 불러오기
try:
    import requests
except ImportError:
    print("[오류] 'requests' 패키지가 설치되어 있지 않습니다.")
    print("-> 해결 방법: 터미널에 'pip install requests'를 입력하여 설치하세요.")
    sys.exit(1)

# 윈도우 터미널에서 한글 출력이 깨지지 않도록 인코딩을 맞춥니다.
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def main():
    # --------------------------------------------------------------------------
    # 기본 설정 (비유: 편지 보낼 주소와 받을 사람 이름 적기)
    # --------------------------------------------------------------------------
    # 올라마가 내 컴퓨터에서 대기하고 있는 기본 주소입니다.
    ollama_url = "http://localhost:11434/api/generate"
    
    # 요청하신 모델 이름 (만약 다른 모델을 쓰려면 이 부분만 바꾸면 됩니다)
    model_name = "qwen3.5:0.8b"

    print("\n" + "="*65)
    print(f"🤖 [Ollama 로컬 AI 연결 준비] 대상 모델: {model_name}")
    print("="*65)
    print("💡 팁: 질문을 입력하시면 내 컴퓨터의 그래픽카드/CPU가 직접 답변을 생각합니다.")
    print("(프로그램을 종료하시려면 'quit', 'exit' 또는 '종료'를 입력하세요)")
    print("-" * 65)

    while True:
        try:
            # 사용자에게 질문 입력받기
            user_input = input("\n[사용자 질문 입력]: ").strip()
            
            if not user_input:
                continue
                
            if user_input.lower() in ['quit', 'exit', '종료']:
                print("\n[안내] 대화를 종료합니다. 좋은 하루 보내세요!")
                break

            print(f"[안내] {model_name} 모델이 열심히 답변을 생각하는 중입니다...")

            # ------------------------------------------------------------------
            # 올라마 서버로 보낼 택배 상자(JSON 데이터) 포장하기
            # ------------------------------------------------------------------
            payload = {
                "model": model_name,    # 답변할 모델 이름
                "prompt": user_input,   # 사용자가 던진 질문
                "stream": False         # 답변이 완결될 때까지 기다렸다가 한 번에 받기
            }

            # POST 방식으로 데이터 전송 (비유: 우체국 창구에 택배 상자 접수하기)
            response = requests.post(ollama_url, json=payload, timeout=60)

            # 서버가 정상(200 OK)적으로 응답했는지 확인
            if response.status_code == 200:
                # 받은 응답(JSON 문자열)을 파이썬 딕셔너리로 해독
                result_data = response.json()
                ai_answer = result_data.get("response", "").strip()
                
                print(f"\n[{model_name} 답변]:\n{ai_answer}")
                print("-" * 65)
            else:
                # 모델이 없거나 오류가 났을 때 친절하게 안내 (규칙 6번 준수)
                print(f"\n❌ [오류 발생] 서버 응답 코드: {response.status_code}")
                print(f"상세 메시지: {response.text}")
                if response.status_code == 404:
                    print("\n👉 [해결 방법]:")
                    print(f"1. 올라마에 '{model_name}' 모델이 설치되어 있는지 확인하세요.")
                    print(f"2. 터미널에 'ollama pull {model_name}' 명령어를 쳐서 모델을 먼저 다운로드해야 합니다.")

        except requests.exceptions.ConnectionError:
            # 올라마 프로그램 자체가 꺼져 있을 때 발생하는 오류 안내 (규칙 6번 준수)
            print("\n❌ [연결 거부 오류] Ollama 서버에 연결할 수 없습니다!")
            print("👉 [원인]: 내 컴퓨터에서 Ollama 프로그램이 실행되고 있지 않습니다.")
            print("👉 [해결 방법]: 화면 우측 하단 트레이 아이콘이나 시작 메뉴에서 'Ollama' 프로그램을 실행해 주세요.")
            break
        except KeyboardInterrupt:
            print("\n\n[안내] 강제 종료되었습니다. 프로그램을 마칩니다.")
            break
        except Exception as e:
            print(f"\n❌ [예상치 못한 오류]: {str(e)}")
            break


if __name__ == "__main__":
    main()
