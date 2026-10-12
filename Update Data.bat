@echo off
cd /d "%~dp0"
echo Downloading latest IPL ball-by-ball data from cricsheet.org...
if not exist data\raw mkdir data\raw
curl -L -o data\raw\ipl_male_json.zip https://cricsheet.org/downloads/ipl_male_json.zip
python -I scripts\build_data.py data\raw\ipl_male_json.zip app\public\data\ipl.json
pause
