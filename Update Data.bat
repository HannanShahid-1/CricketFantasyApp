@echo off
cd /d "%~dp0"
echo Downloading latest IPL ball-by-ball data from cricsheet.org...
curl -L -o dataaw\ipl_male_json.zip https://cricsheet.org/downloads/ipl_male_json.zip
python -I scriptsuild_data.py dataaw\ipl_male_json.zip app\public\data\ipl.json
pause
