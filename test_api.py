import urllib.request
import json
import os

url = "http://127.0.0.1:8000/predict"
file_path = "Image20260627122222.jpg"

if not os.path.exists(file_path):
    print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
    exit(1)

print(f"📡 API 서버({url})에 '[{file_path}]' 사진을 보내 판독을 요청합니다...")

# urllib를 사용한 multipart/form-data 전송 구현
boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
with open(file_path, 'rb') as f:
    file_content = f.read()

body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="{file_path}"\r\n'
    f'Content-Type: image/jpeg\r\n\r\n'
).encode('utf-8') + file_content + f'\r\n--{boundary}--\r\n'.encode('utf-8')

req = urllib.request.Request(url, data=body)
req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')

try:
    with urllib.request.urlopen(req) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        print("\n🎉 [서버 응답 성공] AI 매표소(API 서버)에서 도착한 판독 결과입니다:\n")
        print(json.dumps(res_data, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"\n❌ API 호출 실패: {e}")
    print("💡 아직 서버가 켜지는 중일 수 있습니다. 잠시 후 다시 시도해 주세요.")
