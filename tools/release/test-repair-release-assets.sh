#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export GITHUB_REPOSITORY=purysho/EduBoard
export MOCK_RELEASE_DIR="$TMP/release"
mkdir -p "$MOCK_RELEASE_DIR" "$TMP/bin"

CORE=(
  EduBoard-arm64.dmg
  EduBoard-arm64.dmg.blockmap
  EduBoard-arm64.zip
  EduBoard-arm64.zip.blockmap
  EduBoard-Portable.exe
  EduBoard-Setup.exe
  EduBoard-Setup.exe.blockmap
  EduBoard-x64.dmg
  EduBoard-x64.dmg.blockmap
  EduBoard-x64.zip
  EduBoard-x64.zip.blockmap
  EduBoard.AppImage
  latest-linux.yml
  latest-mac.yml
  latest.yml
  SHA256SUMS-ubuntu-latest.txt
  SHA256SUMS-windows-latest.txt
)
for asset in "${CORE[@]}"; do
  printf 'fixture:%s\n' "$asset" > "$MOCK_RELEASE_DIR/$asset"
done

cat > "$TMP/bin/gh" <<'GH'
#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = api ]; then
  printf 'v0.7.5\n'
  exit 0
fi

[ "${1:-}" = release ] || exit 2
case "${2:-}" in
  view)
    if printf '%s\n' "$@" | grep -Fq -- '--json'; then
      find "$MOCK_RELEASE_DIR" -maxdepth 1 -type f -printf '%f\n' | sort
    fi
    ;;
  download)
    pattern=''
    dir=''
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --pattern) pattern=$2; shift 2 ;;
        --dir) dir=$2; shift 2 ;;
        *) shift ;;
      esac
    done
    cp "$MOCK_RELEASE_DIR/$pattern" "$dir/$pattern"
    ;;
  upload)
    shift 2
    for arg in "$@"; do
      case "$arg" in
        --repo|--clobber) ;;
        purysho/EduBoard) ;;
        *) [ -f "$arg" ] && cp "$arg" "$MOCK_RELEASE_DIR/$(basename "$arg")" ;;
      esac
    done
    ;;
  *) exit 2 ;;
esac
GH
chmod +x "$TMP/bin/gh"
export PATH="$TMP/bin:$PATH"

first=$(bash "$ROOT/tools/release/repair-release-assets.sh" --audit-recent)
grep -Fq 'Release v0.7.5 has the complete expected asset set.' <<<"$first"
test -f "$MOCK_RELEASE_DIR/EduBoard.dmg"
test -f "$MOCK_RELEASE_DIR/SHA256SUMS-macos-latest.txt"

second=$(bash "$ROOT/tools/release/repair-release-assets.sh" --audit-recent)
grep -Fq 'No recent release has the complete core set with missing derived Mac assets.' <<<"$second"

echo 'release repair regression test passed'
