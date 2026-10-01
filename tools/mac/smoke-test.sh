#!/usr/bin/env bash
# Checks built Mac apps on GitHub's macOS runners:
# - signature is valid;
# - native modules load for the app's own architecture;
# - the GUI starts and stays running when the app architecture is native to the runner.
#
# With APP + ARCH arguments, validates that one app and requires a native GUI launch:
#   bash tools/mac/smoke-test.sh dist/intel/EduBoard.app x64
#
# With no arguments (the arm64 release builder), validates both packages but treats only
# arm64 as the GUI authority. The x64 package still gets signature/native-module checks
# through Rosetta; a separate macos-15-intel job performs the authoritative x64 GUI test.
set -o pipefail
fail=0

check() {
  local app=$1 arch=$2 gui=${3:-yes} run=()
  local host
  host=$(uname -m)

  if [ "$arch" = x64 ] && [ "$host" = arm64 ]; then
    run=(arch -x86_64)
  elif [ "$arch" = arm64 ] && [ "$host" != arm64 ]; then
    echo "::error::$arch: cannot validate an arm64 app natively on $host"
    fail=1
    return
  fi

  echo "== $app ($arch; host $host; gui $gui)"
  if [ ! -d "$app" ]; then
    echo "::error::$arch: app bundle is missing"
    fail=1
    return
  fi

  codesign --verify --deep --strict --verbose=2 "$app" || {
    echo "::error::$arch: bad signature"
    fail=1
  }

  local exe="$PWD/$app/Contents/MacOS/EduBoard"
  local res="$PWD/$app/Contents/Resources"

  # Show every native module that shipped, then prove the two native dependencies can be
  # loaded by this app's own Electron process for the target architecture.
  find "$res/app.asar.unpacked" -name '*.node' -exec file {} \;
  ELECTRON_RUN_AS_NODE=1 "${run[@]}" "$exe" -e "
    const D = require('$res/app.asar.unpacked/node_modules/better-sqlite3');
    const db = new D(':memory:');
    console.log('better-sqlite3 ok:', db.prepare('select sqlite_version() v').get().v);
    require('$res/app.asar/node_modules/@napi-rs/canvas');
    console.log('canvas ok, arch', process.arch);
  " || {
    echo "::error::$arch: native modules don't load"
    fail=1
  }

  if [ "$gui" != yes ]; then
    echo "GUI startup intentionally deferred to a native $arch runner"
    return
  fi

  # A native GUI launch exercises Chromium/Electron's real sandbox. Do not add
  # --no-sandbox here: this check exists specifically to validate the shipped boundary.
  local log wait=30
  log=$(mktemp)
  "$exe" >"$log" 2>&1 &
  local pid=$!
  sleep "$wait"

  if kill -0 "$pid" 2>/dev/null; then
    echo "started and still running after ${wait}s"
    kill "$pid"; sleep 2; kill -9 "$pid" 2>/dev/null
  else
    echo "::error::$arch: the app quit or crashed on start"
    fail=1
  fi

  if grep -Eiq "uncaught|was compiled against|incompatible architecture|cannot find module|failed to load the app window" "$log"; then
    echo "::error::$arch: errors while starting"
    fail=1
  fi
  tail -20 "$log"
}

if [ "$#" -eq 2 ]; then
  check "$1" "$2" yes
  exit $fail
fi
if [ "$#" -ne 0 ]; then
  echo "usage: $0 [APP_PATH ARCH]"
  exit 2
fi

check dist/mac-arm64/EduBoard.app arm64 yes
check dist/mac/EduBoard.app x64 no
exit $fail
