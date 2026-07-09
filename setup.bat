@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ==================================================
echo  ZipPT AI Interior Studio - One-time Setup
echo ==================================================

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.10+ and add it to PATH.
    pause
    exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node.js LTS and add it to PATH.
    pause
    exit /b 1
)

if not exist venv (
    echo [1/4] Creating Python virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create venv.
        pause
        exit /b 1
    )
) else (
    echo [1/4] venv already exists - skipping
)

echo [2/4] Installing Python packages ^(this may take several minutes^)...
".\venv\Scripts\python.exe" -m pip install --upgrade pip
".\venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] pip install failed. Check the log above.
    pause
    exit /b 1
)

echo [3/4] Installing frontend packages...
pushd frontend
call npm.cmd install
if errorlevel 1 (
    echo [ERROR] npm install failed. Check the log above.
    popd
    pause
    exit /b 1
)
popd

echo [4/4] Preparing .env ...
if not exist .env (
    copy .env.example .env >nul
    echo   .env created from .env.example
) else (
    echo   .env already exists - skipping
)

echo.
echo ==================================================
echo  Setup complete!
echo   1. Edit .env  : GOOGLE_API_KEY, COMFYUI_PATH
echo   2. (Optional) Install ComfyUI + models - see README.md
echo   3. Start everything with run_app.bat
echo ==================================================
pause
