@echo off
cd /d "%~dp0"
echo ==================================================
echo * ZipPT AI Interior Studio Startup Tool *
echo ==================================================

:: Set ComfyUI path
set "COMFYUI_PATH=C:\Users\USER\Desktop\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"

:: Read ComfyUI path from .env
if exist .env (
    for /f "usebackq tokens=1,2 delims==" %%i in (".env") do (
        if "%%i"=="COMFYUI_PATH" (
            set "COMFYUI_PATH=%%j"
        )
    )
)

:: Clear quotes
if defined COMFYUI_PATH (
    set "COMFYUI_PATH=%COMFYUI_PATH:"=%"
)

echo 1. FastAPI 백엔드 서버 구동 중... (포트 8000)
:: Run backend using venv if exists (without outer quote nesting)
if exist ".\.venv\Scripts\python.exe" (
    start "FastAPI Backend" cmd /k .\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
) else if exist ".\venv\Scripts\python.exe" (
    start "FastAPI Backend" cmd /k .\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
) else (
    start "FastAPI Backend" cmd /k python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
)

echo 2. Starting React Frontend (Port 5173)...
start /D "frontend" "React Frontend" cmd /k npm run dev

echo 3. Starting ComfyUI Server (Port 8188)...
if exist "%COMFYUI_PATH%\run_nvidia_gpu.bat" (
    start /D "%COMFYUI_PATH%" "ComfyUI Server" cmd /k run_nvidia_gpu.bat
) else (
    echo [경고] ComfyUI 실행 파일 %COMFYUI_PATH%\run_nvidia_gpu.bat 을 찾을 수 없습니다.
)

echo ==================================================
echo Waiting for servers to initialize...
timeout /t 4 /nobreak > nul
:: Auto-browser launch commented out by user request
:: start http://localhost:5173
echo Startup commands completed. (Auto-browser launch disabled)
echo ==================================================
