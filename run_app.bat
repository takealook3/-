@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ==================================================
echo ?? ZipPT AI 인테리어 스튜디오 통합 실행기 ??
echo ==================================================
echo 1. FastAPI 백엔드 서버 구동 중... (포트 8000)
start "FastAPI Backend" cmd /k ".\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"
echo 2. React (Vite) 프론트엔드 개발 서버 구동 중... (포트 5173)
start "React Frontend" cmd /k "cd frontend && npm.cmd run dev"
echo 3. ComfyUI AI 가속 서버 구동 중... (포트 8188)
if exist "C:\Users\USER\Desktop\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\run_nvidia_gpu.bat" (
    start "ComfyUI Server" cmd /k "cd C:\Users\USER\Desktop\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable && run_nvidia_gpu.bat"
) else (
    echo [경고] 로컬 ComfyUI 포터블 실행 파일을 찾을 수 없습니다. 이미 켜져 있거나 경로를 확인해 주세요.
)
echo ==================================================
echo 서버 초기 기동을 위해 4초 대기 후 브라우저를 실행합니다...
timeout /t 4 /nobreak > nul
start http://localhost:5173
echo 모든 서버 실행 및 브라우저 기동 명령을 완료했습니다.
echo ==================================================
pause
