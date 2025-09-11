@echo off
echo Starting CoopEditor...
echo.

echo Starting Backend Server...
start cmd /k "node server.js"

timeout /t 3 /nobreak > nul

echo Starting Frontend Development Server (Port 5173)...
start cmd /k "npm run dev"

echo.
echo Both servers are starting...
echo Frontend: http://localhost:5173
echo Backend running on the same process
echo.
echo Access the application at: http://localhost:5173
echo.
pause
