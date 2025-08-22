@echo off
echo Starting CoopEditor...
echo.

echo Starting Backend Server (Port 3002)...
start cmd /k "cd server && node server.js"

timeout /t 3 /nobreak > nul

echo Starting Frontend Development Server (Port 5174)...
start cmd /k "npm run dev"

echo.
echo Both servers are starting...
echo Frontend: http://localhost:5174
echo Backend: http://localhost:3002
echo.
pause
