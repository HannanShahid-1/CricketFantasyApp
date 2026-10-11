@echo off
title Seam - Fantasy Cricket
cd /d "%~dp0app"
if not exist node_modules (
  echo Installing dependencies, first run only...
  call npm install
)
echo Starting Seam at http://localhost:5174
call npm run dev -- --port 5174 --open
