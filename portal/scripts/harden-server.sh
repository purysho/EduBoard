#!/usr/bin/env bash
# Locks down a Portal server (Debian or Ubuntu). Run as root; Harden-Server.cmd runs it for
# you. Safe to run again: each step checks what's already there.
#
#   bash harden-server.sh               firewall, blocking of repeated failed sign-ins,
#                                       automatic security updates, and the Portal running
#                                       as its own user instead of root
#   bash harden-server.sh lock-ssh      turn off password sign-in over SSH (keys only).
#                                       Refuses unless root already has a key to sign in with.
#   bash harden-server.sh allow-passwords
#                                       undo lock-ssh, e.g. from VPS.do's web console after
#                                       losing the computer that had the key
#
# Options (environment variables):
#   EB_SSH_KEY     a public key to add to root's authorized_keys first (one line)
#   EB_SCHOOL_TZ   time zone the schools are in (default Asia/Shanghai); automatic restarts
#                  after updates happen at 04:00 there
#   PORTAL_DIR     the Portal folder (default /opt/eduboard/portal)
set -euo pipefail

MODE="${1:-harden}"
PORTAL_DIR="${PORTAL_DIR:-/opt/eduboard/portal}"
SCHOOL_TZ="${EB_SCHOOL_TZ:-Asia/Shanghai}"
SSHD_DROPIN=/etc/ssh/sshd_config.d/10-eduboard.conf
SERVICE=eduboard-portal
SERVICE_DROPIN_DIR="/etc/systemd/system/$SERVICE.service.d"
SERVICE_USER=eduboard

say() { printf '\n==> %s\n' "$*"; }
ok() { printf '    %s\n' "$*"; }
fail() { printf '\nPROBLEM: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || fail "Run this as root."

reload_sshd() {
  sshd -t || return 1
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null ||
    service ssh reload 2>/dev/null || return 1
}

# The effective setting, as sshd itself reads its configuration.
sshd_setting() { sshd -T 2>/dev/null | awk -v k="$1" '$1 == k { print $2; exit }'; }

add_key() {
  local key="$1"
  case "$key" in
    ssh-ed25519\ * | ssh-rsa\ * | ecdsa-sha2-*) ;;
    *) fail "That doesn't look like an SSH public key; nothing was changed." ;;
  esac
  install -d -m 700 /root/.ssh
  touch /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
  # Compare on the key itself (type and value), not the comment after it.
  if awk '{ print $1, $2 }' /root/.ssh/authorized_keys | grep -qxF "$(echo "$key" | awk '{ print $1, $2 }')"; then
    ok "this computer's key was already allowed"
  else
    printf '%s\n' "$key" >> /root/.ssh/authorized_keys
    ok "added this computer's key ($(echo "$key" | awk '{ print $3 }'))"
  fi
}

# ---- lock-ssh / allow-passwords ---------------------------------------------------------------
if [ "$MODE" = lock-ssh ]; then
  say "Turning off password sign-in over SSH"
  grep -qE '^(ssh-|ecdsa-)' /root/.ssh/authorized_keys 2>/dev/null ||
    fail "root has no SSH key to sign in with, so password sign-in was left on."
  mkdir -p /etc/ssh/sshd_config.d
  cat > "$SSHD_DROPIN" <<'CONF'
# Written by EduBoard's harden-server.sh. Only keys can sign in; root only with a key.
# To undo: bash /opt/eduboard/portal/scripts/harden-server.sh allow-passwords
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
CONF
  # Older sshd_config files don't read the .d folder; say so rather than edit them blindly.
  grep -qiE '^\s*Include\s+/etc/ssh/sshd_config\.d/' /etc/ssh/sshd_config ||
    { rm -f "$SSHD_DROPIN"; fail "This server's SSH settings don't read /etc/ssh/sshd_config.d; nothing was changed."; }
  reload_sshd || { rm -f "$SSHD_DROPIN"; fail "SSH didn't accept the new settings; nothing was changed."; }
  [ "$(sshd_setting passwordauthentication)" = no ] ||
    { rm -f "$SSHD_DROPIN"; reload_sshd || true; fail "Another setting keeps passwords on (see /etc/ssh/sshd_config); nothing was changed."; }
  ok "done: only computers with a key can sign in now"
  exit 0
fi

if [ "$MODE" = allow-passwords ]; then
  say "Turning password sign-in over SSH back on"
  rm -f "$SSHD_DROPIN"
  reload_sshd || fail "SSH didn't reload; check: sshd -t"
  ok "done: passwords work again ($(sshd_setting passwordauthentication))"
  exit 0
fi

[ "$MODE" = harden ] || fail "Unknown option: $MODE (use lock-ssh or allow-passwords)"
command -v apt-get >/dev/null || fail "This script is for Debian or Ubuntu servers."

if [ -n "${EB_SSH_KEY:-}" ]; then
  say "Allowing this computer to sign in with its key"
  add_key "$EB_SSH_KEY"
fi

export DEBIAN_FRONTEND=noninteractive
say "Installing the firewall, sign-in blocking and automatic updates"
apt-get update -qq >/dev/null
apt-get install -y -qq ufw fail2ban python3-systemd unattended-upgrades >/dev/null
ok "installed"

# ---- Firewall ---------------------------------------------------------------------------------
# Only SSH and the web (Caddy) are reachable from outside. The Portal's own port stays
# reachable from this server only, through Caddy.
say "Firewall: only SSH and the web are open"
SSH_PORT="$(sshd_setting port)"
SSH_PORT="${SSH_PORT:-22}"
ufw allow "$SSH_PORT/tcp" comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'web' >/dev/null
ufw allow 443/tcp comment 'web' >/dev/null
ufw allow 443/udp comment 'web (HTTP/3)' >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw --force enable >/dev/null
ok "open: $SSH_PORT (SSH), 80 and 443 (web); everything else is closed"

# ---- Blocking repeated failed sign-ins --------------------------------------------------------
say "Blocking addresses that keep failing to sign in over SSH"
cat > /etc/fail2ban/jail.d/eduboard.local <<'CONF'
# Written by EduBoard's harden-server.sh.
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
CONF
systemctl enable fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban
sleep 2
if fail2ban-client status sshd >/dev/null 2>&1; then
  ok "5 failures in 10 minutes blocks an address for an hour"
else
  echo "    fail2ban didn't start; see: journalctl -u fail2ban -n 30 (the rest carries on)"
fi

# ---- Automatic security updates -------------------------------------------------------------
# Security fixes install every day. When one needs a restart (a new kernel), the server
# restarts at 04:00 school time; the Portal, Caddy and the firewall come back on their own.
say "Automatic security updates"
REBOOT_AT="$(date -d "@$(TZ="$SCHOOL_TZ" date -d '04:00' +%s)" +%H:%M)"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF
cat > /etc/apt/apt.conf.d/52eduboard-upgrades <<CONF
// Written by EduBoard's harden-server.sh.
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "$REBOOT_AT";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
CONF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
ok "on; restarts when needed at $REBOOT_AT server time (04:00 in $SCHOOL_TZ)"

# ---- The Portal as its own user ---------------------------------------------------------------
# So a flaw in the Portal can't take over the server: it runs as a user that can write only
# to its data folder, with the rest of the system read-only. If it doesn't come back up
# like that, the change is undone.
say "Running the Portal as its own user, not root"
UNIT_FILE="/etc/systemd/system/$SERVICE.service"
if [ ! -f "$UNIT_FILE" ]; then
  echo "    skipped: the Portal isn't the $SERVICE systemd service (run Update-Live-Portal.cmd once, then this again)"
else
  ENV_FILE="$(sed -n 's/^EnvironmentFile=-\{0,1\}//p' "$UNIT_FILE" | head -1)"
  DATA_DIR="$PORTAL_DIR/data"
  PORT=4790
  if [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then
    D="$(sed -n 's/^PORTAL_DATA_DIR=//p' "$ENV_FILE" | tail -1 | tr -d '"'"'")"
    [ -n "$D" ] && DATA_DIR="$D"
    P="$(sed -n 's/^PORT=//p' "$ENV_FILE" | tail -1 | tr -d '"'"'")"
    [ -n "$P" ] && PORT="$P"
  fi
  case "$DATA_DIR" in /root/* | /home/*) HOME_RULE="" ;; *) HOME_RULE="ProtectHome=true" ;; esac
  id "$SERVICE_USER" >/dev/null 2>&1 ||
    useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$SERVICE_USER"
  mkdir -p "$DATA_DIR" "$SERVICE_DROPIN_DIR"
  OLD_OWNER="$(stat -c %U "$PORTAL_DIR")"
  chown -R "$SERVICE_USER": "$PORTAL_DIR" "$DATA_DIR"
  chmod 750 "$DATA_DIR"
  cat > "$SERVICE_DROPIN_DIR/hardening.conf" <<UNIT
# Written by EduBoard's harden-server.sh. Delete this file and run
# "systemctl daemon-reload && systemctl restart $SERVICE" to undo.
[Service]
User=$SERVICE_USER
Group=$SERVICE_USER
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ReadWritePaths=$DATA_DIR
$HOME_RULE
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
UNIT
  systemctl daemon-reload
  systemctl restart "$SERVICE"
  UP=""
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then UP=1; break; fi
    sleep 1
  done
  if [ -n "$UP" ]; then
    ok "the Portal runs as '$SERVICE_USER' and can write only to $DATA_DIR"
  else
    rm -f "$SERVICE_DROPIN_DIR/hardening.conf"
    chown -R "$OLD_OWNER": "$PORTAL_DIR" "$DATA_DIR"
    systemctl daemon-reload
    systemctl restart "$SERVICE"
    echo "    the Portal didn't start as its own user, so this step was undone; it runs as before."
    echo "    Details: journalctl -u $SERVICE -n 40"
  fi
fi

say "Done"
echo "    Firewall:        $(ufw status | head -1)"
echo "    Sign-in blocking: $(systemctl is-active fail2ban)"
echo "    Security updates: $(systemctl is-enabled unattended-upgrades 2>/dev/null || echo unknown)"
echo "    SSH passwords:    $(sshd_setting passwordauthentication)"
