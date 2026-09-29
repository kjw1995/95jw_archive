#!/usr/bin/env bash
# 챕터 리팩토링 파이프라인: 초안 검사 → 설치(CRLF) → 재검사 → 커밋·푸시
#
#   tools/chapter-pipeline.sh <초안.md> <content/.../NN-slug.md> [커밋메시지파일]
#
# 커밋 메시지 파일을 주지 않으면 검사와 설치까지만 한다.
# Windows(Git Bash), macOS, Linux 공통. node 18+ 와 git 만 있으면 된다.
set -u
DRAFT=${1:?초안 경로}
TARGET=${2:?대상 content 경로}
MSG=${3:-}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT" || exit 1

echo "=== 1. 초안 검사 (폭·링크·표·callout·금지 표현) ==="
node tools/check-chapter.js "$DRAFT" --links-as "$TARGET" || { echo "초안 검사 실패. 설치하지 않음."; exit 1; }

echo "=== 2. 설치 (CRLF) ==="
node tools/check-chapter.js --install "$DRAFT" "$TARGET"

echo "=== 3. 설치본 재검사 ==="
node tools/check-chapter.js "$TARGET" --crlf || { echo "설치본 검사 실패. 커밋하지 않음."; exit 1; }

if [ -z "$MSG" ]; then echo "커밋 메시지 파일이 없어 여기서 멈춘다."; exit 0; fi

echo "=== 4. 커밋·푸시 ==="
git add "$TARGET" && git commit -q -F "$MSG" || { echo "커밋 실패"; exit 1; }
if ! git push origin main; then
  echo "푸시 거부. rebase 후 재시도."
  git pull --rebase origin main && git push origin main
fi
git log -1 --stat --format="%h %s"
