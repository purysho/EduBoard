# EduBoard Portal

A small, standalone service that lets students/parents check grades, attendance, and
(for university-level classes) homework from home — without a VPN in mainland China.

This is **not** part of the desktop app's build. It's a separate Node service you deploy
once, on your own small server, and the desktop app talks to it over plain HTTPS from
then on (Settings → Portal and families → Portal URL / Portal sync secret).

## How it fits together

- The **desktop app** stays the source of truth for everything. Nothing here can change
  your local data.
- **Publish to portal** (Settings) pushes your current roster, grades, attendance,
  homework, and invite codes here, replacing what the Portal has each time.
- **Pull homework status** (Settings) brings back only the homework status students set
  for themselves — the one thing that flows back into the desktop app, and only when you
  click it.
- **Join links** (a class's Portal tab, in the desktop app) are how students create an
  account: one reusable class link where they type their own details, or a personal
  single-use link per student. Neither shows the class list (see `routes/invites.js`).
  Students who join through a class link are kept here until the desktop imports them.

## Why Hong Kong

`api.anthropic.com`-style Western hosting is unreliable from mainland China without a
VPN. A Hong Kong VPS is generally reachable without one, needs no ICP license (unlike
hosting on mainland China), and is cheap (a few dollars/month for something this small).
See the main project's chat history / CLAUDE.md for the fuller reachability/legal
tradeoffs if you want them again.

## Trying it on your own computer first

Double-click `Start-Test-Portal.cmd` in the repository root (Windows), or run
`node portal/scripts/local-test.js`. It sets itself up, publishes a demo class and
opens the browser. See [docs/TESTING_WITHOUT_A_TERMINAL.md](../docs/TESTING_WITHOUT_A_TERMINAL.md).

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
   | `HOST` | all interfaces | Set `127.0.0.1` to accept connections from this machine only (Caddy on the same machine still works). The local test launcher sets this. |
   | `PORTAL_TIMEZONE` | `UTC` | Only used until a teacher's desktop app publishes once. After that, each teacher's own time zone decides when their due dates end (Late/Missing labels). |
   | `HOMEPAGE_HOSTS` | none | Comma-separated host names (e.g. `edu-board.com,www.edu-board.com`) whose front page is EduBoard's homepage with downloads instead of the student login. The homepage is always at `/download` too. Point those names at this server and add them to the Caddyfile (Set-Up-Homepage.cmd does both server steps). |
   | `PORTAL_DEMO` | off | `1` adds a public demo family login (username `demo`, password `try-eduboard`) on a made-up class under its own demo teacher, reset every day and left out of the admin page's usage numbers. Its password, email and QR logins can't be changed. The homepage shows the login when it's on. `set-up-homepage.sh` turns it on. |
   | `PORTAL_CONSENT` | on | `off` stops asking families to agree to the terms of use at first sign-in, for a school that collects consent another way (on paper, for example). When it's on, the admin page downloads the records as a CSV. |
   | `PORTAL_HOST` | none | The Portal's own address (e.g. `portal.edu-board.com`), where the homepage's "Log in" links send students and parents when it's shown on a `HOMEPAGE_HOSTS` name. |
   | `TRUST_PROXY` | `loopback` | Which proxy to trust for the client's real IP (`X-Forwarded-For`). Keep the default when Caddy runs on the same machine. Setting it more loosely lets clients fake their IP and dodge rate limits. |
   | `RATE_LOGIN_PER_IP` | `100` | Failed logins per IP per 15 min. Successful logins never count, so a class signing in together over the school's one address isn't paused. |
   | `RATE_LOGIN_FAILS_PER_USER` | `10` | Failed logins per username per 15 min before that account is paused. |
   | `RATE_SECRET_URL_PER_IP` | `300` | Invite-code and QR-login requests per IP per 15 min (joining is two requests per student; codes can't be guessed at any rate). |
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
9. **In the desktop app**, go to Settings → Portal and families → set Portal URL to
   `https://portal.yourdomain.com` and Portal sync secret to the same `SYNC_SECRET` you
   set above. Click "Publish to portal" once to push your first batch of data.

### Showing the homepage on your main domain

To make `yourdomain.com` show EduBoard's homepage while the Portal stays at
`portal.yourdomain.com`: point `@` and `www` at the Portal server (A records with the same
address as `portal`), then run `portal/scripts/set-up-homepage.sh` on the server as root
(`HOMEPAGE_DOMAIN=yourdomain.com` for a domain other than edu-board.com). It checks the DNS,
sets `HOMEPAGE_HOSTS` and `PORTAL_HOST`, adds the domain to the Caddyfile (keeping a
`.bak` copy, and putting it back if Caddy rejects the change), and checks the result. On
Windows, `Set-Up-Homepage.cmd` does all of this for edu-board.com.

### Locking down the server

`portal/scripts/harden-server.sh` (Debian or Ubuntu, as root) sets up the basics a school's
IT review will ask about, and is safe to run again:

- **Firewall** (ufw): only SSH, 80 and 443 are reachable; the Portal's own port is reached
  only through Caddy.
- **fail2ban**: 5 failed SSH sign-ins in 10 minutes blocks the address for an hour.
- **Automatic security updates** (unattended-upgrades). When an update needs a restart,
  the server restarts at 04:00 school time (`EB_SCHOOL_TZ`, default `Asia/Shanghai`).
- **The Portal as its own user**: a systemd drop-in runs the `eduboard-portal` service as
  user `eduboard`, able to write only to its data folder (`ProtectSystem=strict`). If the
  Portal doesn't come back up like that, the change is undone.
- `harden-server.sh lock-ssh` turns off SSH password sign-in (keys only). It refuses unless
  root already has a key. `harden-server.sh allow-passwords` undoes it, e.g. from VPS.do's
  web console after losing the computer with the key.

On Windows, `Harden-Server.cmd` does it all: it updates the Portal, makes an SSH key for
the computer (if it has none) and installs it on the server, then checks that the key
works before offering to turn off password sign-in.

## Multiple teachers on one Portal (a school deployment)

One Portal can serve several teachers — each gets their own sync secret and only ever
sees their own classes, students, grades, and homework. To manage teachers, open
`https://portal.yourdomain.com/admin.html` and enter your `ADMIN_SECRET`. From there you
can:

- **Add a teacher.** Their sync secret is shown exactly once, so copy it then and give
  it to them privately to paste into their desktop app's Settings → Portal and families → Portal sync secret.
  The Portal URL is the same for every teacher on this deployment.
- **See who's using the Portal**, with a class and student count for each teacher.
- **Remove a teacher.** Their sync secret stops working at once, and their classes and
  students are deleted from the Portal. Their desktop app keeps all its own data.

Removing a teacher deletes everything of theirs on the Portal: classes, grades,
homework and submitted files, materials, class posts, and their students' profiles,
photos and accounts (an account also linked to another teacher's student is kept).
It can't be undone; their desktop app keeps all of its own data.

The admin secret is remembered only in that browser tab and is never put in a URL.
Wrong guesses are rate limited like every other secret. The same actions are available
as an API (`GET/POST /api/admin/teachers`, `DELETE /api/admin/teachers/:id`, with an
`X-Admin-Secret` header) if you'd rather script them.

The AI provider/key and the weekly digest SMTP settings (Settings → AI → Student AI /
Settings → Portal and families → Weekly parent digest email on the desktop app) are per-teacher — each teacher's own
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

Plus what students add themselves: homework submissions, messages, and their profile.

**First login.** A new student gets a short tour (about 30 seconds) that walks through
the real tabs: Home and what's due, Classwork, Study, Grades and Messages, and Account.
It's recorded against their account, so it isn't repeated on their next device, and
"Show the tour again" under Account replays it.

**Works without a VPN in mainland China.** The page loads nothing from other servers
(no Google Fonts, CDNs or analytics); it uses the device's own fonts. If you add
anything to `public/`, keep it that way.

**Student profiles.** After signing up, a student can fill in (all optional) a photo,
preferred name, pronouns, an "about me", date of birth, learning goals, "anything my
teacher should know", a preferred language (also the default for translating
messages), and private notes. The teacher sees the profile on the student's page in the
desktop app, except the private notes (never shared) and the date of birth (shared
only as month and day, and only if the student ticks the box). Photos must be JPEG,
PNG or WebP. They're checked by content, capped at 8 MB, and rebuilt from their pixels
as a 512×512 WebP, which removes location data and anything hidden in the file.

**Uploaded files are checked by content, not just by name.** A submission must be a
document, image, audio or video type, and its bytes must match that type: a program
renamed `essay.docx` is refused, as are Office files with macros and RTF files with
embedded objects. The desktop app re-checks every file before opening it, and on
Windows marks it as downloaded from the internet, so Office opens it in Protected View.

**Photo processing uses [sharp](https://sharp.pixelplumbing.com/)**, which `npm install`
fetches as a prebuilt binary for Linux, macOS and Windows. Nothing else to install on
the server.

## Backups

Student accounts and handed-in work exist only on the server, so they're backed up every
night at 03:30 (server time) into `/root/eduboard-backups`, keeping the last 14. Running
the updater (`Update-EduBoard.cmd`, or `scripts/update-server.sh` on the server) sets
this up, and takes one backup straight away. Each backup is one `.tar.gz` holding the
database (copied safely while the Portal runs), every uploaded file, and `.env`.

To take one by hand: `cd /opt/eduboard/portal && npm run backup`.

To restore one (replace the file name with the backup you want):

```
systemctl stop eduboard-portal
mkdir /tmp/restore && tar -xzf /root/eduboard-backups/eduboard-portal-<date>.tar.gz -C /tmp/restore
cp -a /opt/eduboard/portal/data /root/data-before-restore
rm -rf /opt/eduboard/portal/data && cp -a /tmp/restore/data /opt/eduboard/portal/data
systemctl start eduboard-portal
```

(If your service has another name, or the data folder is elsewhere via
`PORTAL_DATA_DIR`, use those instead.) To keep a copy off the server too, download a
backup now and then, e.g. `scp root@portal.edu-board.com:/root/eduboard-backups/*.tar.gz .`

## Recovery, not self-service email resets

There's no "forgot password" email flow by design — this app has no mail service, and
mail deliverability from a fresh VPS is its own headache. Instead:

- **Forgot password (usual way)** → on the login page the student taps "Ask your teacher
  for a reset" and enters their username. The request appears on the teacher's
  Dashboard with the student's name; **Approve** lets that same device (and only it)
  choose a new password, which signs the account out everywhere else. Requests expire
  after a day, and asking about a username that doesn't exist looks exactly the same,
  so nobody can find out who has an account.
- **Or, set a temporary password yourself** → in the desktop app, Settings → Portal and families →
  "Reset a student's Portal password". Enter their username, click Generate (or type a
  temporary password), and give it to them. The reset signs that account out on every
  device. It only works for accounts linked to your own students. Students can then
  pick their own password under Account on the Portal.
- **Too many wrong passwords** → the account is paused for up to 15 minutes, even for
  the right password. Waiting works. A reset from the desktop app gives them a password
  that works once the pause ends.
- **Lost the saved QR image** → the family just logs in with username/password and
  downloads a fresh one; no teacher involvement needed at all.
- **Class link shared too widely** → **New link** in the class's Portal tab (the old
  one stops working) or **Turn off**. A student who lost their personal link can use the
  class link instead.

## Error codes and the server log

Every error the Portal answers with has a code (`{ "error": "…", "code": "PT-3001" }`),
shown after the message on the Portal's pages and inside the desktop app's messages.
[docs/ERROR_CODES.md](../docs/ERROR_CODES.md) says what each code means and what to do.
An unexpected server error (PT-9900) also carries a reference; the same reference is in
the server log with the details:

```bash
journalctl -u eduboard-portal --since today | grep 7KQ2MX
```

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
