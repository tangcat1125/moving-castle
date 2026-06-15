@echo off
title 3D Moving Castle Local Server
echo ===================================================
echo   Starting local server for 3D Moving Castle...
echo   This avoids CORS issues when loading textures.
echo   Press Ctrl+C in this window to stop the server.
echo ===================================================
echo.
start "" "http://localhost:8000"
python -m http.server 8000
