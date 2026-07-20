#!/bin/bash
# 설교 쇼츠 메이커를 웹앱으로 실행합니다 (맥용).
# 이 파일을 더블클릭하면 됩니다.
set -e
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js가 설치되어 있지 않습니다."
  echo "https://nodejs.org 에서 설치한 뒤 이 파일을 다시 실행하세요."
  read -n 1 -s -r -p "아무 키나 누르면 창을 닫습니다..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "처음 실행이라 필요한 프로그램을 설치합니다. 몇 분 걸릴 수 있어요..."
  npm install
fi

if [ ! -f .next/BUILD_ID ]; then
  echo "처음 실행이라 앱을 준비합니다..."
  npm run build
fi

echo "설교 쇼츠 메이커를 시작합니다..."
( sleep 2 && open "http://localhost:3939" ) &
npm run start
