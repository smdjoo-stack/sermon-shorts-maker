@echo off
REM 설교 쇼츠 메이커를 웹앱으로 실행합니다 (윈도우용).
REM 이 파일을 더블클릭하면 됩니다.
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 설치한 뒤 이 파일을 다시 실행하세요.
  pause
  exit /b 1
)

if not exist node_modules (
  echo 처음 실행이라 필요한 프로그램을 설치합니다. 몇 분 걸릴 수 있어요...
  call npm install
  if errorlevel 1 (
    echo 설치 중 오류가 발생했습니다.
    pause
    exit /b 1
  )
)

if not exist .next\BUILD_ID (
  echo 처음 실행이라 앱을 준비합니다...
  call npm run build
  if errorlevel 1 (
    echo 준비 중 오류가 발생했습니다.
    pause
    exit /b 1
  )
)

echo 설교 쇼츠 메이커를 시작합니다...
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3939"
call npm run start
pause
