@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Falta Node.js 18 o superior: https://nodejs.org & pause & exit /b 1)
node server.js
pause
