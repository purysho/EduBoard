#!/usr/bin/env bash
# Repairs release assets that are derived from already-published installers.
# It never rebuilds or replaces the canonical platform binaries.
set -euo pipefail

REPO=${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}
CORE_MAC=(EduBoard-arm64.dmg EduBoard-arm64.zip EduBoard-x64.dmg EduBoard-x64.zip)
EXPECTED=(
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
  EduBoard.dmg
  latest-linux.yml
  latest-mac.yml
  latest.yml
  SHA256SUMS-macos-latest.txt
  SHA256SUMS-ubuntu-latest.txt
  SHA256SUMS-windows-latest.txt
)

asset_list() {
  gh release view "$1" --repo "$REPO" --json assets --jq '.assets[].name'
}

contains_asset() {
  local list=$1 asset=$2
  grep -Fxq "$asset" <<<"$list"
}

has_repairable_core() {
  local list=$1 asset
  for asset in "${EXPECTED[@]}"; do
    case "$asset" in
      EduBoard.dmg|SHA256SUMS-macos-latest.txt) continue ;;
    esac
    contains_asset "$list" "$asset" || return 1
  done
}

needs_derived_repair() {
  local list=$1
  ! contains_asset "$list" EduBoard.dmg ||
    ! contains_asset "$list" SHA256SUMS-macos-latest.txt
}

verify_complete() {
  local tag=$1 list asset missing=0
  list=$(asset_list "$tag")
  for asset in "${EXPECTED[@]}"; do
    if ! contains_asset "$list" "$asset"; then
      echo "::error::Missing release asset for $tag: $asset"
      missing=1
    fi
  done
  if [ "$missing" -ne 0 ]; then
    echo "Published assets for $tag:"
    printf '%s\n' "$list" | sort
    return 1
  fi
}

repair_tag() (
  local tag=$1 dir asset
  [[ "$tag" == v* ]] || { echo "::error::Refusing non-version release tag: $tag"; return 1; }
  gh release view "$tag" --repo "$REPO" >/dev/null

  dir=$(mktemp -d)
  trap 'rm -rf "$dir"' EXIT

  for asset in "${CORE_MAC[@]}"; do
    gh release download "$tag" --repo "$REPO" --pattern "$asset" --dir "$dir"
  done

  cp "$dir/EduBoard-arm64.dmg" "$dir/EduBoard.dmg"
  (
    cd "$dir"
    sha256sum \
      EduBoard-arm64.dmg \
      EduBoard-arm64.zip \
      EduBoard-x64.dmg \
      EduBoard-x64.zip \
      > SHA256SUMS-macos-latest.txt
  )

  gh release upload "$tag" \
    --repo "$REPO" \
    "$dir/EduBoard.dmg" \
    "$dir/SHA256SUMS-macos-latest.txt" \
    --clobber

  verify_complete "$tag"
  echo "Release $tag has the complete expected asset set."
)

audit_recent() {
  local tag list repaired=0
  while IFS= read -r tag; do
    [ -n "$tag" ] || continue
    list=$(asset_list "$tag")
    if has_repairable_core "$list" && needs_derived_repair "$list"; then
      echo "Repairing incomplete derived assets for $tag"
      repair_tag "$tag"
      repaired=$((repaired + 1))
    fi
  done < <(
    gh api "repos/$REPO/releases?per_page=20" \
      --jq '.[] | select(.draft == false and (.tag_name | startswith("v"))) | .tag_name'
  )

  if [ "$repaired" -eq 0 ]; then
    echo "No recent release has the complete core set with missing derived Mac assets."
  fi
}

case "${1:-}" in
  --tag)
    [ -n "${2:-}" ] || { echo "usage: $0 --tag vX.Y.Z" >&2; exit 2; }
    repair_tag "$2"
    ;;
  --audit-recent)
    audit_recent
    ;;
  *)
    echo "usage: $0 --tag vX.Y.Z | --audit-recent" >&2
    exit 2
    ;;
esac
