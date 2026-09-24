@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install the Node.js LTS version, then run this file again.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

echo Starting Smart Soil Probe AI Dashboard...
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:4173/"
node server.mjs

echo.
echo Dashboard stopped. Press any key to close this window.
pause >nul
