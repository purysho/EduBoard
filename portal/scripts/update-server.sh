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
#   GITHUB_TOKEN      a read-only GitHub token, needed once the repository is private.
#                     It's saved to /root/.eduboard-github-token (root-only) and used
#                     automatically on later updates, so it only has to be given once.
#
# Once the repository is private, run the copy this script installs on the server:
#   bash /opt/eduboard/portal/scripts/update-server.sh
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
  TOKEN_FILE=/root/.eduboard-github-token
  TOKEN="${GITHUB_TOKEN:-}"
  if [ -n "$TOKEN" ]; then
    (umask 077 && printf '%s' "$TOKEN" > "$TOKEN_FILE")
    echo "    saved the GitHub token for next time"
  elif [ -r "$TOKEN_FILE" ]; then
    TOKEN="$(cat "$TOKEN_FILE")"
  fi
  if [ -n "$TOKEN" ]; then
    # The API's tarball works for private repositories (the plain archive link doesn't).
    curl -fsSL -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/$REPO/tarball/$BRANCH" -o "$WORK/src.tar.gz" ||
      fail "Download failed. The GitHub token may have expired or lack access to $REPO; nothing was changed."
  else
    curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.tar.gz" -o "$WORK/src.tar.gz" ||
      fail "Download failed. If the repository is private, run again with a token: GITHUB_TOKEN=... bash $0. Nothing was changed."
  fi
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
# Find the running Portal itself (a node process in, or started from, the Portal folder),
# then ask the system what started it, rather than guessing service names.
say "Restarting the Portal"
PORTAL_PIDS=""
for d in /proc/[0-9]*; do
  cmd="$(tr '\0' ' ' < "$d/cmdline" 2>/dev/null || true)"
  cwd="$(readlink "$d/cwd" 2>/dev/null || true)"
  case "$cmd" in
    *node*"$PORTAL_DIR/server.js"*) PORTAL_PIDS="$PORTAL_PIDS ${d#/proc/}" ;;
    *node*server.js*) [ "$cwd" = "$PORTAL_DIR" ] && PORTAL_PIDS="$PORTAL_PIDS ${d#/proc/}" ;;
  esac
done
PID="$(echo "$PORTAL_PIDS" | awk '{print $1}')"

RESTARTED=""
RUN_ENV=""
if [ -n "$PID" ]; then
  RUN_ENV="$(tr '\0' '\n' < "/proc/$PID/environ" 2>/dev/null || true)"
  UNIT="$(grep -oE '[^/]+\.service' "/proc/$PID/cgroup" 2>/dev/null | grep -vE '^(user@|session-)' | head -1 || true)"
  PM2_HOME_OF="$(echo "$RUN_ENV" | sed -n 's/^PM2_HOME=//p' | head -1)"
  PM_ID="$(echo "$RUN_ENV" | sed -n 's/^pm_id=//p' | head -1)"
  if [ -n "$PM2_HOME_OF" ] && [ -n "$PM_ID" ]; then
    PM2_USER="$(stat -c %U "/proc/$PID")"
    PM2_BIN="$(command -v pm2 || true)"
    [ -z "$PM2_BIN" ] && PM2_BIN="$(dirname "$(readlink -f "/proc/$PID/exe")")/pm2"
    if [ -x "$PM2_BIN" ] &&
      runuser -u "$PM2_USER" -- env PM2_HOME="$PM2_HOME_OF" "$PM2_BIN" restart "$PM_ID" >/dev/null 2>&1; then
      RESTARTED="pm2 app $PM_ID (user $PM2_USER)"
    fi
  elif [ -n "$UNIT" ] && systemctl restart "$UNIT" 2>/dev/null; then
    RESTARTED="systemd service $UNIT"
  fi
fi

# Started by hand (e.g. with nohup) or not running at all: set it up as a proper service
# so it also comes back after a reboot, using the settings the running Portal had.
if [ -z "$RESTARTED" ] && command -v systemctl >/dev/null && [ -d /run/systemd/system ]; then
  ENV_FILE="/etc/eduboard-portal.env"
  # Holds the Portal's secrets: readable by root only, from the moment it's created.
  umask 077
  if [ -n "$RUN_ENV" ]; then
    echo "$RUN_ENV" | grep -E '^(SESSION_SECRET|SYNC_SECRET|ADMIN_SECRET|PORT|HOST|NODE_ENV|TRUST_PROXY|PORTAL_[A-Z_]*|RATE_[A-Z_]*|SMTP_[A-Z_]*)=' > "$ENV_FILE.new"
  elif [ -f "$PORTAL_DIR/.env" ]; then
    cp "$PORTAL_DIR/.env" "$ENV_FILE.new"
  fi
  if [ -s "$ENV_FILE.new" ] && grep -q '^SESSION_SECRET=' "$ENV_FILE.new"; then
    mv "$ENV_FILE.new" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    RUN_USER="$( [ -n "$PID" ] && stat -c %U "/proc/$PID" || stat -c %U "$PORTAL_DIR")"
    NODE_BIN="$( [ -n "$PID" ] && readlink -f "/proc/$PID/exe" || command -v node)"
    cat > /etc/systemd/system/eduboard-portal.service <<UNIT
[Unit]
Description=EduBoard Portal
After=network.target

[Service]
WorkingDirectory=$PORTAL_DIR
ExecStart=$NODE_BIN server.js
EnvironmentFile=$ENV_FILE
User=$RUN_USER
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload
    for p in $PORTAL_PIDS; do kill "$p" 2>/dev/null || true; done
    sleep 2
    systemctl enable --now eduboard-portal >/dev/null 2>&1 && RESTARTED="new systemd service eduboard-portal (starts on boot)"
  else
    rm -f "$ENV_FILE.new"
  fi
fi

if [ -z "$RESTARTED" ]; then
  echo "    Couldn't restart it automatically. Details for whoever set up the server:"
  echo "    running Portal process: ${PID:-none found}"
  [ -n "$PID" ] && echo "    started as: $(tr '\0' ' ' < "/proc/$PID/cmdline")" && echo "    cgroup: $(head -3 "/proc/$PID/cgroup" | tr '\n' ' ')"
  fail "Updated, but not restarted. Rebooting the server from the VPS.do panel will start the new version if the Portal starts on boot."
fi
echo "    restarted $RESTARTED"

# ---- 6. Check -------------------------------------------------------------------------------
PORT="$(echo "$RUN_ENV" | sed -n 's/^PORT=//p' | head -1)"
[ -z "$PORT" ] && PORT="$(grep -E '^PORT=' "$PORTAL_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '"'"'")"
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
