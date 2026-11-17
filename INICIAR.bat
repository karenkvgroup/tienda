@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Primero instala Node.js desde https://nodejs.org y volve a abrir este archivo. & pause & exit /b)
start "" http://localhost:3000
node server.js
pause
