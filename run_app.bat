@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ==================================================
echo 🏠 ZipPT AI 인테리어 스튜디오 통합 실행기 🏠
echo ==================================================

:: 기본 Fallback 경로 설정 (사용자 미지정 시 사용)
set "COMFYUI_PATH=C:\Users\USER\Desktop\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"

:: .env 파일에서 COMFYUI_PATH 환경변수 읽기
if exist .env (
    for /f "usebackq tokens=1,2 delims==" %%i in (".env") do (
        if "%%i"=="COMFYUI_PATH" (
            set "COMFYUI_PATH=%%j"
        )
    )
)

:: 따옴표 정화 및 앞뒤 공백 제거 대응
if defined COMFYUI_PATH (
    set "COMFYUI_PATH=%COMFYUI_PATH:"=%"
)

echo 1. FastAPI 백엔드 서버 구동 중... (포트 8000)
start "FastAPI Backend" cmd /k ".\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"
echo 2. React (Vite) 프론트엔드 개발 서버 구동 중... (포트 5173)
start "React Frontend" cmd /k "cd frontend && npm.cmd run dev"
echo 3. ComfyUI AI 가속 서버 구동 중... (포트 8188)
if exist "%COMFYUI_PATH%\run_nvidia_gpu.bat" (
    start "ComfyUI Server" cmd /k "cd /d "%COMFYUI_PATH%" && run_nvidia_gpu.bat"
) else (
    echo [경고] 로컬 ComfyUI 포터블 실행 파일 %COMFYUI_PATH%\run_nvidia_gpu.bat 을 찾을 수 없습니다. 이미 켜져 있거나 경로를 확인해 주세요.
)
echo ==================================================
echo 서버 초기 기동을 위해 4초 대기 후 브라우저를 실행합니다...
timeout /t 4 /nobreak > nul
start http://localhost:5173
echo 모든 서버 실행 및 브라우저 기동 명령을 완료했습니다.
echo ==================================================
pause
