@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul || (echo Install Node.js 22.12+ for source checks. & pause & exit /b 1)
if not exist node_modules call npm ci
call npm run check
if errorlevel 1 (pause & exit /b 1)
if exist ".venv\Scripts\python.exe" (
  .venv\Scripts\python.exe -m pip install -r requirements-dev.txt
  .venv\Scripts\python.exe -m pytest tests research_module/tests -q
) else (
  python -m pip install -r requirements-dev.txt
  python -m pytest tests research_module/tests -q
)
pause
endlocal
