#!/usr/bin/env bash
# Checks the built Mac apps actually work, on a Mac (GitHub's macOS runners):
# signature is valid, the native modules load in each app's own Electron for its
# own chip (Intel via Rosetta), and the app starts and keeps running.
set -o pipefail
fail=0
check() {
  local app=$1 arch=$2 run=() wait=30
  # Intel runs under Rosetta here, which is slow the first time: give it longer
  # to load its window before judging it.
  [ "$arch" = x64 ] && run=(arch -x86_64) && wait=90
  echo "== $app ($arch)"
  if [ ! -d "$app" ]; then echo "missing"; fail=1; return; fi
  codesign --verify --deep --strict --verbose=2 "$app" || { echo "::error::$arch: bad signature"; fail=1; }

  local exe="$PWD/$app/Contents/MacOS/EduBoard" res="$PWD/$app/Contents/Resources"
  # Every native module shipped, and which chip it's built for.
  find "$res/app.asar.unpacked" -name '*.node' -exec file {} \;
  ELECTRON_RUN_AS_NODE=1 "${run[@]}" "$exe" -e "
    const D = require('$res/app.asar.unpacked/node_modules/better-sqlite3');
    const db = new D(':memory:');
    console.log('better-sqlite3 ok:', db.prepare('select sqlite_version() v').get().v);
    require('$res/app.asar/node_modules/@napi-rs/canvas');
    console.log('canvas ok, arch', process.arch);
  " || { echo "::error::$arch: native modules don't load"; fail=1; }

  local log; log=$(mktemp)
  "${run[@]}" "$exe" >"$log" 2>&1 &
  local pid=$!
  sleep "$wait"
  if kill -0 "$pid" 2>/dev/null; then
    echo "started and still running after ${wait}s"
    kill "$pid"; sleep 2; kill -9 "$pid" 2>/dev/null
  else
    echo "::error::$arch: the app quit or crashed on start"; fail=1
  fi
  if grep -Eiq "uncaught|was compiled against|incompatible architecture|cannot find module|failed to load the app window" "$log"; then
    echo "::error::$arch: errors while starting"; fail=1
  fi
  tail -20 "$log"
}
check dist/mac-arm64/EduBoard.app arm64
check dist/mac/EduBoard.app x64
exit $fail
