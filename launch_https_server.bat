@echo off
REM Start Python HTTPs server on port 4443, listening on all interfaces
start "" /B python https_server.py

REM Give the server a moment to start
timeout /t 2 >nul

REM Open browser (adjust path if needed)
start "" https://%COMPUTERNAME%:4443/index.html
