#!/usr/bin/env bash
# Makes edu-board.com (and www.edu-board.com) show EduBoard's homepage with downloads,
# served by this Portal server, while the Portal stays at portal.edu-board.com.
# Run on the server as root; Set-Up-Homepage.cmd does that. Safe to run again.
# Before running it, point edu-board.com and www.edu-board.com at this server (DNS).
set -euo pipefail

DOMAIN="${HOMEPAGE_DOMAIN:-edu-board.com}"
PORTAL_HOST="${PORTAL_HOST:-portal.$DOMAIN}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
UNIT=eduboard-portal

say() { echo; echo "==> $*"; }
fail() { echo; echo "    PROBLEM: $*"; exit 1; }
ipv4() { getent ahostsv4 "$1" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' '; }

# ---- 1. DNS -----------------------------------------------------------------------------
say "Checking $DOMAIN points at this server"
SERVER_IPS="$(ipv4 "$PORTAL_HOST")"
[ -n "$SERVER_IPS" ] || fail "Couldn't look up $PORTAL_HOST."
DOMAIN_IPS="$(ipv4 "$DOMAIN")"
[ "$DOMAIN_IPS" = "$SERVER_IPS" ] ||
  fail "$DOMAIN points at '${DOMAIN_IPS:-nothing}', but this server is '$SERVER_IPS'. At your domain registrar, set the A record for @ ($DOMAIN) to ${SERVER_IPS% }, wait a few minutes, then run this again."
WWW=""
if [ "$(ipv4 "www.$DOMAIN")" = "$SERVER_IPS" ]; then
  WWW="www.$DOMAIN"
  echo "    $DOMAIN and $WWW both point here"
else
  echo "    $DOMAIN points here (www.$DOMAIN doesn't yet, so it's left out; run this again once it does)"
fi

# ---- 2. The Portal's settings -------------------------------------------------------------
say "Telling the Portal about $DOMAIN"
PORTAL_DIR="$(systemctl show -p WorkingDirectory --value "$UNIT" 2>/dev/null || true)"
ENV_FILE="$(systemctl show -p EnvironmentFiles --value "$UNIT" 2>/dev/null | awk '{print $1}' | sed 's/^-//')"
[ -n "$PORTAL_DIR" ] && [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ] ||
  fail "The Portal isn't running as the '$UNIT' service yet. Run Update-Live-Portal.cmd first, then this again."
grep -q "PORTAL_HOST" "$PORTAL_DIR/server.js" ||
  fail "This Portal is older than the homepage. Run Update-Live-Portal.cmd first, then this again."
HOSTS="$DOMAIN${WWW:+,$WWW}"
cp "$ENV_FILE" "$ENV_FILE.bak"
sed -i '/^HOMEPAGE_HOSTS=/d; /^PORTAL_HOST=/d; /^PORTAL_DEMO=/d' "$ENV_FILE"
# PORTAL_DEMO=1: the homepage's "Try it first" box offers a demo family login (username
# demo) on a made-up class, reset daily and left out of the admin page's numbers.
printf 'HOMEPAGE_HOSTS=%s\nPORTAL_HOST=%s\nPORTAL_DEMO=1\n' "$HOSTS" "$PORTAL_HOST" >> "$ENV_FILE"
systemctl restart "$UNIT"
echo "    HOMEPAGE_HOSTS=$HOSTS, PORTAL_HOST=$PORTAL_HOST, demo login on"

# ---- 3. Caddy (web addresses and certificates) ----------------------------------------------
say "Adding $DOMAIN to Caddy"
[ -f "$CADDYFILE" ] || fail "No Caddy settings at $CADDYFILE. Ask whoever set up the server where Caddy's settings are."
UPSTREAM="$(grep -oE 'reverse_proxy[[:space:]]+[^[:space:]{}]+' "$CADDYFILE" | head -1 | awk '{print $2}')"
[ -n "$UPSTREAM" ] || fail "Couldn't find the Portal (a reverse_proxy line) in $CADDYFILE."
cp "$CADDYFILE" "$CADDYFILE.bak"
# Replace an earlier block from this script, so running it again doesn't add a second one.
sed -i '/^# >>> EduBoard homepage/,/^# <<< EduBoard homepage/d' "$CADDYFILE"
{
  echo "# >>> EduBoard homepage (added by set-up-homepage.sh)"
  echo "$DOMAIN {"
  echo "  reverse_proxy $UPSTREAM"
  echo "}"
  if [ -n "$WWW" ]; then
    echo "$WWW {"
    echo "  redir https://$DOMAIN{uri} permanent"
    echo "}"
  fi
  echo "# <<< EduBoard homepage"
} >> "$CADDYFILE"
if ! caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
  cp "$CADDYFILE.bak" "$CADDYFILE"
  fail "Caddy didn't accept the new settings, so the old ones were put back. Nothing changed."
fi
systemctl reload caddy
echo "    $DOMAIN goes to the Portal server at $UPSTREAM${WWW:+; $WWW goes to $DOMAIN}"

# ---- 4. Check ---------------------------------------------------------------------------
say "Checking https://$DOMAIN (the first certificate can take a minute)"
for _ in $(seq 1 24); do
  # Read the whole page before looking in it: with pipefail, "curl | grep -q" fails when
  # grep stops reading early, even though the page was there.
  PAGE="$(curl -fsS --max-time 10 "https://$DOMAIN/" 2>/dev/null || true)"
  if [[ "$PAGE" == *"teacher’s desk"* ]]; then
    echo
    echo "    Done. https://$DOMAIN shows EduBoard's homepage; the Portal is still https://$PORTAL_HOST"
    exit 0
  fi
  sleep 5
done
echo
echo "    Set up, but https://$DOMAIN didn't answer yet. Caddy may still be getting its"
echo "    certificate: try the address in a few minutes. If it still fails, send this:"
journalctl -u caddy --since "-3 min" --no-pager 2>/dev/null | tail -8 || true
exit 1
