# EduBoard Portal

A small, standalone service that lets students/parents check grades, attendance, and
(for university-level classes) homework from home — without a VPN in mainland China.

This is **not** part of the desktop app's build. It's a separate Node service you deploy
once, on your own small server, and the desktop app talks to it over plain HTTPS from
then on (Settings → Portal URL / Portal sync secret).

## How it fits together

- The **desktop app** stays the source of truth for everything. Nothing here can change
  your local data.
- **Publish to portal** (Settings) pushes your current roster, grades, attendance,
  homework, and invite codes here, replacing what the Portal has each time.
- **Pull homework status** (Settings) brings back only the homework status students set
  for themselves — the one thing that flows back into the desktop app, and only when you
  click it.
- **Invite strips** (a class's Portal tab, in the desktop app) are what a family redeems
  here to create an account, pre-scoped to that one class.

## Why Hong Kong

`api.anthropic.com`-style Western hosting is unreliable from mainland China without a
VPN. A Hong Kong VPS is generally reachable without one, needs no ICP license (unlike
hosting on mainland China), and is cheap (a few dollars/month for something this small).
See the main project's chat history / CLAUDE.md for the fuller reachability/legal
tradeoffs if you want them again.

## Deploying (Hong Kong VPS)

1. **Get a VPS.** Any mainstream provider with a Hong Kong region works. The cheapest
   tier is enough — this is a small SQLite-backed service, not a heavy web app.
2. **Point a domain at it.** Buy/reuse a domain, add an A record to the VPS's IP. You
   need a domain for HTTPS (a magic-login link or password over plain HTTP would leak
   credentials to anyone on the network).
3. **Install Node.js** (22+) on the VPS.
4. **Copy this `portal/` directory** to the VPS (e.g. `git clone` the whole EduBoard
   repo, or `scp` just this folder — it doesn't need the rest of the repo).
5. **Install dependencies:**
   ```bash
   cd portal
   npm install
   ```
6. **Set environment variables** — create `portal/.env` (or export them in your systemd
   service, see below):
   ```
   SESSION_SECRET=<a long random string — generate with `openssl rand -hex 32`>
   SYNC_SECRET=<a different long random string — this is what you also paste into the desktop app's Settings>
   ADMIN_SECRET=<a third long random string — only needed for a multi-teacher deployment, see below>
   PORT=4790
   NODE_ENV=production
   ```
   All three secrets must be kept private — `SYNC_SECRET` in particular lets whoever has
   it overwrite that teacher's entire dataset, and `ADMIN_SECRET` lets whoever has it
   create and remove teacher accounts on this Portal.

   Optional settings (the defaults suit one teacher's classes behind Caddy):

   | Variable | Default | What it does |
   |---|---|---|
   | `PORTAL_DATA_DIR` | `portal/data` | Where the database and every upload live. Back up this one folder. |
   | `PORTAL_TIMEZONE` | `UTC` | Only used until a teacher's desktop app publishes once. After that, each teacher's own time zone decides when their due dates end (Late/Missing labels). |
   | `TRUST_PROXY` | `loopback` | Which proxy to trust for the client's real IP (`X-Forwarded-For`). Keep the default when Caddy runs on the same machine. Setting it more loosely lets clients fake their IP and dodge rate limits. |
   | `RATE_LOGIN_PER_IP` | `50` | Login attempts per IP per 15 min. Raise it if a whole computer lab shares one IP. |
   | `RATE_LOGIN_FAILS_PER_USER` | `10` | Failed logins per username per 15 min before that account is paused. |
   | `RATE_SECRET_URL_PER_IP` | `60` | Invite-code and QR-login requests per IP per 15 min. |
   | `RATE_BAD_SECRET_PER_IP` | `20` | Wrong sync/admin secrets per IP per 15 min. Correct ones never count. |
   | `RATE_AI_PER_MINUTE` | `6` | AI chat + translation requests per student account per minute. |
   | `RATE_AI_PER_DAY` | `100` | The same, per 24 hours. These calls spend your own AI key. |
   | `RATE_PASSWORD_CHANGE` | `5` | Password-change attempts per account per 15 min. |

   Rate limits are kept in memory, so restarting the Portal resets them.
7. **Put it behind HTTPS.** The simplest option is
   [Caddy](https://caddyserver.com/) — install it, then a `Caddyfile` like:
   ```
   portal.yourdomain.com {
     reverse_proxy localhost:4790
   }
   ```
   Caddy handles the Let's Encrypt certificate automatically. Start it as a service
   (`sudo systemctl enable --now caddy` on most distros' packaged builds).
8. **Run the Portal as a systemd service** so it survives reboots — `/etc/systemd/system/eduboard-portal.service`:
   ```ini
   [Unit]
   Description=EduBoard Portal
   After=network.target

   [Service]
   WorkingDirectory=/path/to/portal
   ExecStart=/usr/bin/node server.js
   EnvironmentFile=/path/to/portal/.env
   Restart=on-failure
   User=eduboard

   [Install]
   WantedBy=multi-user.target
   ```
   Then:
   ```bash
   sudo systemctl enable --now eduboard-portal
   ```
9. **In the desktop app**, go to Settings → set Portal URL to
   `https://portal.yourdomain.com` and Portal sync secret to the same `SYNC_SECRET` you
   set above. Click "Publish to portal" once to push your first batch of data.

## Multiple teachers on one Portal (a school deployment)

One Portal can serve several teachers — each gets their own sync secret and only ever
sees their own classes, students, grades, and homework. To manage teachers, open
`https://portal.yourdomain.com/admin.html` and enter your `ADMIN_SECRET`. From there you
can:

- **Add a teacher.** Their sync secret is shown exactly once, so copy it then and give
  it to them privately to paste into their desktop app's Settings → Portal sync secret.
  The Portal URL is the same for every teacher on this deployment.
- **See who's using the Portal**, with a class and student count for each teacher.
- **Remove a teacher.** Their sync secret stops working at once, and their classes and
  students are deleted from the Portal. Their desktop app keeps all its own data.

The admin secret is remembered only in that browser tab and is never put in a URL.
Wrong guesses are rate limited like every other secret. The same actions are available
as an API (`GET/POST /api/admin/teachers`, `DELETE /api/admin/teachers/:id`, with an
`X-Admin-Secret` header) if you'd rather script them.

The AI provider/key and the weekly digest SMTP settings (Settings → Student AI /
Weekly parent digest email on the desktop app) are per-teacher — each teacher's own
publish only ever writes their own `ai_settings`/`digest_settings` row, so one
teacher's key or sender address never affects another's.

**Sizing:** each teacher adds a modest amount of load (their own publish pushes, their
families' Portal visits, and — if the digest email or student AI features are used —
more outbound requests). The VPS.DO HK-1H2G tier this app was originally set up on is
fine for one or a handful of teachers; a whole school's staff publishing and families
checking in daily will likely need a larger instance (more RAM in particular, since
better-sqlite3 keeps the working set in memory) — budget for an upgrade before rolling
this out school-wide, not after.

## Data it holds

Only what you publish: class names/types, student names/DOB/number, per-class grade %
and attendance rate, homework titles/descriptions/due dates, and invite codes. No
guardian contact info, no detailed score history, no teacher notes — deliberately a
narrow slice, not a mirror of the full desktop database.

## Recovery, not self-service email resets

There's no "forgot password" email flow by design — this app has no mail service, and
mail deliverability from a fresh VPS is its own headache. Instead:

- **Forgot password, or locked out** → in the desktop app, Settings → Portal sync →
  "Reset a student's Portal password". Enter their username, click Generate (or type a
  temporary password), and give it to them. The reset signs that account out on every
  device. It only works for accounts linked to your own students. Students can then
  pick their own password under Account on the Portal.
- **Too many wrong passwords** → the account is paused for up to 15 minutes, even for
  the right password. Waiting works. A reset from the desktop app gives them a password
  that works once the pause ends.
- **Lost the saved QR image** → the family just logs in with username/password and
  downloads a fresh one; no teacher involvement needed at all.
- **Lost/revoked invite strip** → generate and print a new batch from the class's
  Portal tab in the desktop app; the old, unclaimed strips can be revoked from the same
  tab.

## Local testing

```bash
cd portal
npm install
SESSION_SECRET=test SYNC_SECRET=test ADMIN_SECRET=test PORT=4790 node server.js
```

Automated tests (`npm test`) start real Portal processes on throwaway data folders and
cover the security rules: rate limits, session revocation, and one teacher never
touching another's data. CI runs them on every pull request.
Then visit `http://localhost:4790` — you'll see a login screen until an invite is
redeemed (`http://localhost:4790/?code=<a code your desktop app generated>`).
