# ==============================================================================
# Ollama(올라마) 실시간 타자(스트리밍) 추론 테스트 스크립트
# ==============================================================================
# 비유하자면, AI가 생각을 다 마칠 때까지 기다리지 않고, 
# 단어가 하나씩 떠오를 때마다 실시간으로 타자를 쳐서 보여주는 라이브 방송 시스템입니다!

import sys
import json
import requests

# 윈도우 터미널(CMD)에서 한글 출력이 깨지지 않도록 안전장치를 설정합니다.
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# ------------------------------------------------------------------------------
# 기본 환경 설정 (비유: 방송국 주소와 출연할 AI 배우 이름 설정)
# ------------------------------------------------------------------------------
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen3.5:0.8b"


def chat(prompt: str, stream: bool = True) -> str:
    """
    사용자의 질문(prompt)을 받아 올라마 AI에게 전달하고 답변을 받는 함수입니다.
    :param prompt: 사용자 질문
    :param stream: True면 실시간 타자 모드, False면 한 번에 받기 모드
    """
    # 서버로 보낼 메시지 봉투(JSON 규격)를 준비합니다.
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": stream,
    }

    try:
        # 1. 스트리밍 모드가 아닐 때 (기존처럼 한 번에 답변 받기)
        if not stream:
            resp = requests.post(OLLAMA_URL, json=payload, timeout=60)
            resp.raise_for_status()
            return resp.json()["message"]["content"]

        # 2. 실시간 스트리밍 모드일 때 (글자가 생성되는 즉시 화면에 출력)
        full_text = ""
        # stream=True 옵션을 주면 서버와의 연결을 끊지 않고 데이터를 계속 받아옵니다.
        with requests.post(OLLAMA_URL, json=payload, stream=True, timeout=60) as resp:
            resp.raise_for_status() # 오류 상태 코드(404, 500 등)가 있으면 예외 발생
            
            # 서버가 보내주는 데이터 조각(line)들을 줄 단위로 반복해서 읽습니다.
            for line in resp.iter_lines():
                if not line:
                    continue
                
                # 바이트 데이터를 파이썬 딕셔너리로 변환
                chunk = json.loads(line)
                
                # 방금 생성된 단어 조각(token) 하나를 꺼냅니다.
                token = chunk.get("message", {}).get("content", "")
                
                # end=""와 flush=True를 사용해 줄바꿈 없이 실시간으로 옆으로 타자 치듯 출력합니다!
                print(token, end="", flush=True)
                full_text += token
                
                # AI가 답변을 모두 마쳤다는 신호(done)를 보내면 반복을 종료합니다.
                if chunk.get("done"):
                    break
        
        print() # 답변 출력이 모두 끝나면 깔끔하게 줄바꿈을 해줍니다.
        return full_text

    except requests.exceptions.ConnectionError:
        # 올라마 프로그램이 꺼져 있을 때의 친절한 안내 (규칙 6번 준수)
        print("\n\n❌ [연결 거부 오류] Ollama 서버에 연결할 수 없습니다!")
        print("👉 [원인]: 컴퓨터에서 Ollama 프로그램이 켜져 있지 않습니다.")
        print("👉 [해결 방법]: 시작 메뉴나 트레이 아이콘에서 'Ollama' 프로그램을 실행해 주세요.")
        return ""
    except requests.exceptions.HTTPError as e:
        # 모델이 없거나 서버 오류 시 친절한 안내 (규칙 6번 준수)
        print(f"\n\n❌ [서버 응답 오류]: {e}")
        if resp.status_code == 404:
            print(f"👉 [해결 방법]: 터미널에 'ollama pull {MODEL}'을 입력하여 모델을 먼저 다운로드하세요.")
        return ""


if __name__ == "__main__":
    # 테스트용 질문
    question = "양자역학을 한 문장으로 쉽게 설명해줘."
    print("=" * 65)
    print(f"📡 [Ollama 실시간 스트리밍 테스트] 모델: {MODEL}")
    print("=" * 65)
    print(f"[질문] {question}\n[답변] ", end="", flush=True)
    
    # 실시간 채팅 함수 호출!
    chat(question)
    print("-" * 65)
