@echo off
REM Start Python HTTP server on port 8000, listening on all interfaces
start "" /B python -m http.server 8000 --bind 0.0.0.0

REM Give the server a moment to start
timeout /t 2 >nul

REM Open browser (adjust path if needed)
start "" http://%COMPUTERNAME%:8000/index.html
