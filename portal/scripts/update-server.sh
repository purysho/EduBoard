#!/usr/bin/env bash
# Updates an installed EduBoard Portal to the latest code, keeping its data.
#
# Run on the Portal server as root (for example in your VPS provider's web console):
#
#   curl -fsSL https://raw.githubusercontent.com/purysho/EduBoard/claude/trusting-goodall-hxsi5s/portal/scripts/update-server.sh | bash
#
# What it does, in order, stopping at the first problem:
#   1. Finds the Portal folder (default /opt/eduboard/portal, or pass another path).
#   2. Backs up the Portal's data folder and .env to /root/eduboard-backup-<time>.tar.gz.
#   3. Downloads the new code from GitHub and copies it over the old code. The data
#      folder, .env, node_modules and anything else not in the download are left alone.
#   4. Installs the Portal's dependencies.
#   5. Restarts the Portal (systemd or pm2) and checks it answers.
#
# Options (environment variables):
#   EDUBOARD_BRANCH   which branch to install (default below)
#   EDUBOARD_TARBALL  install from a local .tar.gz of the repository instead of GitHub
set -euo pipefail

BRANCH="${EDUBOARD_BRANCH:-claude/trusting-goodall-hxsi5s}"
REPO="purysho/EduBoard"
PORTAL_DIR="${1:-/opt/eduboard/portal}"
STAMP="$(date +%Y%m%d-%H%M%S)"

say() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[ -f "$PORTAL_DIR/server.js" ] || fail "No Portal found at $PORTAL_DIR. Run: bash update-server.sh /path/to/portal"
command -v node >/dev/null || fail "Node.js isn't installed on this server."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js $NODE_MAJOR is too old; the Portal needs 20 or newer (22 recommended)."

# ---- 1. Where the data lives --------------------------------------------------------------
DATA_DIR="$PORTAL_DIR/data"
if [ -f "$PORTAL_DIR/.env" ] && grep -q '^PORTAL_DATA_DIR=' "$PORTAL_DIR/.env"; then
  DATA_DIR="$(grep '^PORTAL_DATA_DIR=' "$PORTAL_DIR/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'")"
fi

# ---- 2. Backup ----------------------------------------------------------------------------
BACKUP="/root/eduboard-backup-$STAMP.tar.gz"
say "Backing up data and settings to $BACKUP"
BACKUP_ITEMS=()
[ -d "$DATA_DIR" ] && BACKUP_ITEMS+=("$DATA_DIR")
[ -f "$PORTAL_DIR/.env" ] && BACKUP_ITEMS+=("$PORTAL_DIR/.env")
if [ ${#BACKUP_ITEMS[@]} -gt 0 ]; then
  tar -czf "$BACKUP" "${BACKUP_ITEMS[@]}" 2>/dev/null || fail "Backup failed; nothing was changed."
  echo "    saved ($(du -h "$BACKUP" | cut -f1))"
else
  echo "    no data folder found at $DATA_DIR (a fresh install?); continuing"
fi

# ---- 3. New code --------------------------------------------------------------------------
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
if [ -n "${EDUBOARD_TARBALL:-}" ]; then
  say "Using $EDUBOARD_TARBALL"
  cp "$EDUBOARD_TARBALL" "$WORK/src.tar.gz"
else
  say "Downloading the Portal ($BRANCH)"
  curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.tar.gz" -o "$WORK/src.tar.gz" ||
    fail "Download failed; nothing was changed."
fi
tar -xzf "$WORK/src.tar.gz" -C "$WORK"
NEW_PORTAL="$(find "$WORK" -mindepth 2 -maxdepth 2 -type d -name portal | head -1)"
[ -f "$NEW_PORTAL/server.js" ] || fail "The download didn't contain a Portal; nothing was changed."

say "Installing the new code into $PORTAL_DIR"
# Copy file by file so the data folder, .env and node_modules are never touched.
(cd "$NEW_PORTAL" && tar -cf - --exclude=./data --exclude=./node_modules --exclude=./local-test --exclude=./.env .) |
  (cd "$PORTAL_DIR" && tar -xf -)

# ---- 4. Dependencies -----------------------------------------------------------------------
say "Installing dependencies (this can take a minute)"
(cd "$PORTAL_DIR" && npm ci --omit=dev --no-audit --no-fund) ||
  fail "Installing dependencies failed. Your data is safe; the backup is $BACKUP."
# The service may run as a different user than root; keep the code readable by it.
OWNER="$(stat -c %U "$PORTAL_DIR")"
if [ "$OWNER" != "root" ]; then chown -R --from=root "$OWNER" "$PORTAL_DIR" 2>/dev/null || true; fi

# ---- 5. Restart -----------------------------------------------------------------------------
say "Restarting the Portal"
RESTARTED=""
if command -v systemctl >/dev/null && systemctl list-units --type=service --all 2>/dev/null | grep -q .; then
  for unit in $(systemctl list-units --type=service --all --no-legend 2>/dev/null | awk '{print $1}' | grep -iE 'eduboard|portal' || true); do
    if systemctl cat "$unit" 2>/dev/null | grep -q "$PORTAL_DIR"; then
      systemctl restart "$unit" && RESTARTED="systemd service $unit"
    fi
  done
fi
if [ -z "$RESTARTED" ] && command -v pm2 >/dev/null; then
  NAME="$(pm2 jlist 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const app = JSON.parse(s || "[]").find((a) => (a.pm2_env?.pm_cwd || "").startsWith(process.argv[1]))
      if (app) console.log(app.name)
    })' "$PORTAL_DIR" || true)"
  [ -n "$NAME" ] && pm2 restart "$NAME" >/dev/null && RESTARTED="pm2 app $NAME"
fi
[ -n "$RESTARTED" ] || fail "Updated, but couldn't find how the Portal is started, so it wasn't restarted. Restart it (or reboot the server) to finish."
echo "    restarted $RESTARTED"

# ---- 6. Check -------------------------------------------------------------------------------
PORT="$(grep -E '^PORT=' "$PORTAL_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '"'"'")"
PORT="${PORT:-4790}"
say "Checking it's up on port $PORT"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    if curl -fsS "http://127.0.0.1:$PORT/i18n.js" >/dev/null 2>&1; then
      printf '\nDone. The Portal is running the new version.\nBackup: %s\n' "$BACKUP"
      exit 0
    fi
    fail "The Portal answers but is still the old version. Check the service's folder is $PORTAL_DIR."
  fi
  sleep 1
done
fail "The Portal didn't come back up. See: journalctl -u <service> -n 50   (backup: $BACKUP)"
