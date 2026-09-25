#!/bin/bash
# 포토그래핑 앱을 Mac에서 한 번에 준비하고 실행한다. 아이폰의 Expo Go 앱으로 본다.
#
# 처음 실행 (터미널에 한 줄 붙여 넣기. URL과 키는 Supabase 대시보드에서 복사):
#   bash <(curl -fsSL https://raw.githubusercontent.com/ppsilverticket-prog/photographing/refs/heads/claude/awesome-wright-t8ek2d/mobile/scripts/start-mac.sh) 'https://xxxx.supabase.co' 'sb_publishable_xxxx'
# 다음부터는 바탕화면의 "포토그래핑 실행.command"를 더블클릭한다.
#
# 하는 일: 이 앱 전용 Node.js 받기 → 최신 코드 받기 → mobile/.env.local 쓰기 → npm install → expo start
# 모든 파일은 ~/photographing-app 안에만 두고, 관리자 암호를 묻지 않는다.
# URL과 키 없이 실행하면 처음에 물어보고, 그냥 Enter를 누르면 예시 데이터 모드로 실행한다.
#
# PHOTOGRAPHING_DIR, PHOTOGRAPHING_BRANCH, PHOTOGRAPHING_NODE_PLATFORM(예: linux-x64)은 테스트용이다.

set -euo pipefail

REPO="ppsilverticket-prog/photographing"
BRANCH="${PHOTOGRAPHING_BRANCH:-claude/awesome-wright-t8ek2d}"
APP_DIR="${PHOTOGRAPHING_DIR:-$HOME/photographing-app}"
NODE_DIR="$APP_DIR/.node"
NODE_MAJOR=22
LAUNCHER="$HOME/Desktop/포토그래핑 실행.command"

say() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
fail() {
  printf '\n\033[31m✖ %s\033[0m\n' "$*" >&2
  exit 1
}

node_platform() {
  if [ -n "${PHOTOGRAPHING_NODE_PLATFORM:-}" ]; then
    echo "$PHOTOGRAPHING_NODE_PLATFORM"
    return
  fi
  [ "$(uname -s)" = Darwin ] || fail "이 스크립트는 Mac용이에요."
  case "$(uname -m)" in
    arm64) echo darwin-arm64 ;;
    x86_64) echo darwin-x64 ;;
    *) fail "이 Mac의 칩($(uname -m))은 지원하지 않아요." ;;
  esac
}

sha256() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

# 컴퓨터에 설치된 Node와 섞이지 않도록 이 앱 전용 Node.js를 APP_DIR 안에 둔다
install_node() {
  local tmp="$1" platform base line file expected
  if [ -x "$NODE_DIR/bin/node" ] && "$NODE_DIR/bin/node" -v | grep -q "^v$NODE_MAJOR\."; then
    return
  fi
  platform=$(node_platform)
  say "Node.js $NODE_MAJOR 받는 중 (처음 한 번만)"
  base="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"
  line=$(curl -fsSL "$base/SHASUMS256.txt" | grep -E "  node-v[0-9.]+-$platform\.tar\.gz$" | head -n 1) ||
    fail "Node.js 정보를 받지 못했어요. 인터넷 연결을 확인해 주세요."
  expected=$(echo "$line" | awk '{print $1}')
  file=$(echo "$line" | awk '{print $2}')
  curl -fL --progress-bar "$base/$file" -o "$tmp/$file" ||
    fail "Node.js를 받지 못했어요. 인터넷 연결을 확인해 주세요."
  [ "$(sha256 "$tmp/$file")" = "$expected" ] || fail "받은 Node.js 파일이 손상됐어요. 다시 실행해 주세요."
  rm -rf "$NODE_DIR"
  mkdir -p "$NODE_DIR"
  tar --strip-components=1 -xzf "$tmp/$file" -C "$NODE_DIR"
}

# 매번 최신 코드를 받아 덮어쓴다. .env.local과 node_modules는 코드에 없으므로 그대로 남는다
download_code() {
  local tmp="$1"
  say "최신 코드 받는 중"
  if curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" -o "$tmp/code.tar.gz"; then
    mkdir -p "$APP_DIR"
    tar --strip-components=1 -xzf "$tmp/code.tar.gz" -C "$APP_DIR"
  elif [ -f "$APP_DIR/mobile/package.json" ]; then
    echo "새 코드를 받지 못해서 지난번에 받은 코드로 실행해요."
  else
    fail "코드를 받지 못했어요. 인터넷 연결을 확인해 주세요."
  fi
}

write_env() {
  local url="${1:-}" key="${2:-}" env="$APP_DIR/mobile/.env.local"
  if [ -z "$url" ] && [ -z "$key" ]; then
    [ -f "$env" ] && return
    say "Supabase 접속 정보"
    printf 'Project URL을 붙여 넣고 Enter (예시 데이터로만 보려면 그냥 Enter): '
    read -r url || true
    if [ -z "$url" ]; then
      echo "예시 데이터 모드로 실행해요."
      return
    fi
    printf 'publishable 키를 붙여 넣고 Enter: '
    read -r key || true
  fi
  url="${url%/}"
  case "$url" in
    https://*.supabase.co) ;;
    *) fail "URL 형식이 달라요. https://xxxx.supabase.co 모양이어야 해요." ;;
  esac
  case "$key" in
    sb_publishable_*) ;;
    sb_secret_*) fail "secret 키는 앱에 넣으면 안 돼요. Project Settings → API Keys에서 publishable 키를 복사해 주세요." ;;
    *) fail "키 형식이 달라요. sb_publishable_로 시작하는 키를 넣어 주세요." ;;
  esac
  printf 'EXPO_PUBLIC_SUPABASE_URL=%s\nEXPO_PUBLIC_SUPABASE_KEY=%s\n' "$url" "$key" >"$env"
  chmod 600 "$env"
  echo "접속 정보를 저장했어요: mobile/.env.local"
}

install_packages() {
  say "앱에 필요한 패키지 설치 중 (처음에는 몇 분 걸려요)"
  (cd "$APP_DIR/mobile" && npm install --no-audit --no-fund) ||
    fail "패키지 설치에 실패했어요. 위에 나온 오류 문장을 보내 주세요."
}

# 바탕화면 실행 파일. 이 컴퓨터에서 만든 파일이라 macOS가 막지 않는다
make_launcher() {
  [ -d "$HOME/Desktop" ] || return 0
  cat >"$LAUNCHER" <<EOF || return 1
#!/bin/bash
# 포토그래핑 앱을 최신 코드로 실행한다. 끝내려면 이 창에서 Control + C.
exec /bin/bash "$APP_DIR/mobile/scripts/start-mac.sh"
EOF
  chmod +x "$LAUNCHER"
}

main() {
  # curl ... | bash 로 실행해도 Expo가 키보드 입력을 받도록 터미널을 입력으로 쓴다
  if [ ! -t 0 ] && (exec </dev/tty) 2>/dev/null; then
    exec </dev/tty
  fi

  local tmp
  tmp=$(mktemp -d)
  install_node "$tmp"
  export PATH="$NODE_DIR/bin:$PATH"
  download_code "$tmp"
  rm -rf "$tmp"
  write_env "$@"
  install_packages
  # macOS가 묻는 "데스크탑 폴더 접근"을 거부해도 앱은 실행한다
  make_launcher 2>/dev/null ||
    echo "바탕화면에 실행 파일을 만들지 못했어요. 다음에도 같은 한 줄을 붙여 넣으면 돼요."

  say "앱 실행"
  if [ -f "$APP_DIR/mobile/.env.local" ]; then
    echo "서버 모드: Supabase에 연결해요."
  else
    echo "예시 데이터 모드: 서버에 연결하지 않아요."
  fi
  cat <<'EOF'

아이폰에서:
  1. 앱스토어에서 "Expo Go"를 설치해요 (처음 한 번만).
  2. 아이폰과 이 Mac을 같은 와이파이에 연결해요.
  3. 잠시 뒤 아래에 뜨는 QR 코드를 아이폰 기본 카메라로 찍어요.
  4. "로컬 네트워크" 접근을 물으면 허용해요.
     Mac에서 "들어오는 연결을 허용할까요?"라고 물어도 허용해요.

앱을 쓰는 동안 이 창을 닫지 마세요. 끝내려면 Control + C.
EOF
  if [ -f "$LAUNCHER" ]; then
    echo '다음부터는 바탕화면의 "포토그래핑 실행"을 더블클릭하면 돼요.'
  fi
  cd "$APP_DIR/mobile"
  # .env.local이 바뀌어도 반영되도록 캐시를 비우고 시작한다
  exec npx expo start --clear
}

# 스크립트 전체를 읽은 뒤 실행한다 (실행 중 코드를 새로 받아 이 파일이 덮어써져도 안전하도록)
main "$@"
exit
