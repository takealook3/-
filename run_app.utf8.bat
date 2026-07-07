@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ==================================================
echo ?룧 ZipPT AI ?명뀒由ъ뼱 ?ㅽ뒠?붿삤 ?듯빀 ?ㅽ뻾湲??룧
echo ==================================================

:: 湲곕낯 Fallback 寃쎈줈 ?ㅼ젙 (?ъ슜??誘몄??????ъ슜)
set "COMFYUI_PATH=C:\Users\USER\Desktop\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"

:: .env ?뚯씪?먯꽌 COMFYUI_PATH ?섍꼍蹂???쎄린
if exist .env (
    for /f "usebackq tokens=1,2 delims==" %%i in (".env") do (
        if "%%i"=="COMFYUI_PATH" (
            set "COMFYUI_PATH=%%j"
        )
    )
)

:: ?곗샂???뺥솕 諛??욌뮘 怨듬갚 ?쒓굅 ???
if defined COMFYUI_PATH (
    set "COMFYUI_PATH=%COMFYUI_PATH:"=%"
)

echo 1. FastAPI 諛깆뿏???쒕쾭 援щ룞 以?.. (?ы듃 8000)
start "FastAPI Backend" cmd /k ".\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"
echo 2. React (Vite) ?꾨줎?몄뿏??媛쒕컻 ?쒕쾭 援щ룞 以?.. (?ы듃 5173)
start "React Frontend" cmd /k "cd frontend && npm.cmd run dev"
echo 3. ComfyUI AI 媛???쒕쾭 援щ룞 以?.. (?ы듃 8188)
if exist "%COMFYUI_PATH%\run_nvidia_gpu.bat" (
    start "ComfyUI Server" cmd /k "cd /d "%COMFYUI_PATH%" && run_nvidia_gpu.bat"
) else (
    echo [寃쎄퀬] 濡쒖뺄 ComfyUI ?ы꽣釉??ㅽ뻾 ?뚯씪 %COMFYUI_PATH%\run_nvidia_gpu.bat ??李얠쓣 ???놁뒿?덈떎. ?대? 耳쒖졇 ?덇굅??寃쎈줈瑜??뺤씤??二쇱꽭??
)
echo ==================================================
echo ?쒕쾭 珥덇린 湲곕룞???꾪빐 4珥??湲???釉뚮씪?곗?瑜??ㅽ뻾?⑸땲??..
timeout /t 4 /nobreak > nul
start http://localhost:5173
echo 紐⑤뱺 ?쒕쾭 ?ㅽ뻾 諛?釉뚮씪?곗? 湲곕룞 紐낅졊???꾨즺?덉뒿?덈떎.
echo ==================================================
pause
