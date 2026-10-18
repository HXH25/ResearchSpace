@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -3.11 -m venv .venv 2>nul
  if errorlevel 1 python -m venv .venv
  if errorlevel 1 (echo Python 3.11+ is required. & pause & exit /b 1)
)
.venv\Scripts\python.exe -c "import fastapi, uvicorn, httpx, cryptography, socksio" >nul 2>nul
if errorlevel 1 (
  .venv\Scripts\python.exe -m pip install -r requirements.txt
  if errorlevel 1 (echo Dependency installation failed. Check your network. & pause & exit /b 1)
)
echo Open http://127.0.0.1:8000 in your browser.
.venv\Scripts\python.exe run.py
if errorlevel 1 pause
endlocal
