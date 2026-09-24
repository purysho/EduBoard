# Handoff — EduBoard local testing session

Written for a fresh chat picking this up cold. Covers what was built this
session, what got fixed while testing on the user's Windows machine, and the
one blocking issue that testing stalled on.

## Where things stand

- Branch: `claude/elegant-franklin-938cnf` (kept in sync with `v0.3-dev` —
  both point at the same commit as of this handoff, `eb42363`).
- The user's local checkout lives at `C:\Dev\eduboard` (moved out of
  `C:\Users\olive\OneDrive\Desktop\eduboard` mid-session — see "OneDrive"
  below). Portal is a sibling process run from `C:\Dev\eduboard\portal`.
- **Testing is currently blocked**: the desktop app (`npm run dev`) cannot
  load in the user's Electron window. See "Open blocking issue" below —
  that's almost certainly the next thing to resolve before any further
  feature testing can happen.

## What was built this session (before testing started)

Four features requested by the user, all merged and pushed:

1. **Per-teacher AI key / digest SMTP settings** (commit `4f03f51`) — Portal's
   `ai_settings`/`digest_settings` tables were single shared rows; migrated to
   per-`teacher_id` rows with a live-tested legacy-schema migration.
2. **Inline translation on parent-teacher messaging** (`a45c181`) — either
   side can translate a message on demand via the teacher's AI key, cached
   per message+language in a new `message_translations` table. Desktop gets
   a "Translate" link in Messages; Portal gets a language picker.
3. **Portal-side notification badge** (`daf575c`) — poll-based unread-message
   pill + tab-title count on the Portal dashboard (`GET /me/notifications`).
4. **Trend-triggered AI report card comments** (`59789ce`) — "Draft comment"
   now feeds the AI a computed trend direction (improving/declining/steady)
   from the student's existing grade-trend data; a Declining/Improving badge
   also shows next to the trend sparkline on the student's class row.

`EduBoardRoadMap.MD` in the repo root has the full running history of every
phase/feature built before and during this session — read that for broader
context if needed.

## Bugs found and fixed *during* local testing

Testing surfaced several real bugs, each fixed and pushed as its own commit:

- **`94810e3`** — `DateSelect` (Month/Day/Year picker, `src/renderer/src/components/ui/Field.tsx`)
  silently dropped partial picks: it only reported a value up to its parent
  once all three fields were set, but each dropdown's *displayed* value was
  derived from that same (still-empty) parent value — so picking just the
  month made the month dropdown appear to reset itself. Fixed by keying an
  inner component on `value` so partial picks persist in local state between
  real external resets.
- **`4416155`** — the "Print strips" (portal invites) and student-report PDF
  save dialogs were shown with no owner window (`dialog.showSaveDialog` with
  no parent), which on Windows can leave the dialog opened with nothing to
  anchor it to — invisible/behind everything. Fixed via `showSaveDialogOnTop()`
  in `src/main/ipc/register.ts`, which anchors to the actual visible window
  and focuses it. Also added `printed_at` tracking (migration 24) so a
  batch's card shows "Printed <date>" once its PDF is actually saved.
- **`eafbd46`** — print windows (`createPrintWindow` in `src/main/windows.ts`)
  kept getting `ERR_CONNECTION_REFUSED` loading `localhost:5173` even though
  the main window loaded fine from the same URL. Hypothesis: a freshly
  created window's independent DNS resolution for "localhost" can land on
  IPv6 (`::1`) on Windows even when the main window's earlier connection
  landed on IPv4, and Vite's dev server only listens on IPv4. Fixed by
  substituting `127.0.0.1` explicitly for `localhost` in dev mode.
- **`eb42363`** — even with the IPv4 fix, the *main* window itself started
  intermittently failing to load with `ERR_CONNECTION_REFUSED` on first
  launch (a known electron-vite race: Electron opens as soon as Vite's dev
  server starts listening, but "listening" and "ready to accept a
  connection" aren't the same instant). Added a retry loop (20 attempts,
  250ms backoff) to `loadAppRoute()` in `src/main/windows.ts` so a slow
  dev-server start doesn't require a manual app restart.

All four of the above were verified via `npm run typecheck` + `eslint --fix`
(no way to run the actual Electron app in this sandbox to visually confirm —
verification was code-review-level, not click-tested).

## Also fixed: OneDrive

The project was originally cloned into
`C:\Users\olive\OneDrive\Desktop\eduboard` — OneDrive was actively
interfering: the desktop app's SQLite database
(`<project>\data\eduboard.db` in dev mode — see `src/main/db/path.ts`,
`resolveDataDir()`) showed OneDrive sync-error icons and threw
`SqliteError: disk I/O error` on startup. The user moved the whole project
to `C:\Dev\eduboard` (outside any synced folder) via `Move-Item`, then
re-ran `npm install` in both the root and `portal/` from the new location.
This resolved the disk I/O error. **If a fresh chat sees SQLite disk errors
again, check whether the project is inside a cloud-synced folder
(OneDrive/Dropbox/etc.) first.**

## Open blocking issue — read this first

After the OneDrive move and the `eb42363` retry-loop fix, the desktop app
**still** fails to load, with a pattern that ruled out every hypothesis
tried so far:

```
electron: Failed to load URL: http://127.0.0.1:5173/#/ with error: ERR_CONNECTION_REFUSED
```

This repeats on *every* retry attempt (not just the first), across multiple
full app restarts, and the port sometimes increments (5173 → 5174 → back to
5173), suggesting stale/orphaned processes accumulate across attempts too.

**Ruled out already, in order tried:**
1. ~~Stale dev server / needs restart~~ — retried many times, same result.
2. ~~VPN (Astrill) interference~~ — user fully quit Astrill (confirmed gone
   from Task Manager too), issue persisted.
3. ~~OneDrive file locking~~ — project moved to `C:\Dev\eduboard`, unrelated
   disk I/O error went away, but this connection error persisted after the
   move.
4. ~~IPv6/IPv4 "localhost" resolution mismatch~~ — `loadAppRoute` already
   forces `127.0.0.1` explicitly (commit `eafbd46`); still refused even
   connecting to the literal IPv4 address.
5. ~~Windows Firewall blocking the (new-path) electron.exe~~ — checked
   "Allow an app through firewall"; both "Electron" and "electron.exe" were
   already listed and allowed for Private+Public.
6. ~~Simple startup race~~ — the `eb42363` retry loop (20× at 250ms) should
   cover any race under ~5s; it did not help, meaning the connection is
   being refused persistently, not just momentarily during startup.

**Leading unverified hypothesis (where the user's last message left off):**
Windows' dynamic port exclusion ranges (from Hyper-V/WSL2/Docker Desktop, if
installed) can reserve a range of ports such that a server can bind and
report itself as "listening" while new inbound connections to it are still
refused at the OS/NAT level. Asked the user to run, as Administrator:

```
netsh interface ipv4 show excludedportrange protocol=tcp
```

and check whether 5173 or 5174 falls inside a listed range. If so, the
standard fix is:

```
net stop winnat
net start winnat
```

**This was not yet confirmed or tried by the user before this handoff was
requested.** A fresh session should:

1. Ask the user for the output of that `netsh` command (or ask them to run
   it) before trying anything else.
2. If 5173-ish ports are excluded, try the `winnat` restart, then
   `npm run dev` again.
3. If that doesn't fix it, other things worth trying that haven't been yet:
   - Check `netsh advfirewall show allprofiles` for a blocking outbound
     rule (Allowed-apps GUI only shows inbound-style allow rules; there
     could be a separate outbound block).
   - Try `--host 127.0.0.1` explicitly on the vite config / electron-vite
     config to force IPv4-only binding server-side too (currently only the
     *client* side was forced to 127.0.0.1; worth checking
     `electron.vite.config.ts` for the dev server's own `server.host`
     setting).
   - Try a full reboot — several stuck states (zombie Electron process that
     `taskkill` couldn't touch, port bouncing between 5173/5174) suggest
     something in the user's networking stack may be in a genuinely wedged
     state that only a reboot clears.
   - As a fallback to unblock testing entirely: build and run the packaged
     app instead of dev mode (`npm run build:win` then run the installed
     app), since packaged builds load a local `index.html` file directly
     and don't depend on the Vite dev server or `localhost` networking at
     all. This would let testing continue on the four features above while
     the dev-mode networking issue is investigated separately.

## Portal setup (for reference, once desktop app loads again)

The user has a `start.ps1` in `portal/` (not committed — local only) that
sets required env vars and runs `npm start`:

```powershell
$env:SESSION_SECRET="changeme-session-secret-12345"
$env:SYNC_SECRET="changeme-sync-secret-67890"
$env:ADMIN_SECRET="changeme-admin-secret-abcde"
$env:PORT="3000"
npm start
```

Desktop app's Settings → Portal should point at `http://localhost:3000`
with sync secret `changeme-sync-secret-67890` to match.

## Suggested next steps once unblocked

Testing had just gotten through re-verifying the "Print strips" and
attendance date-picker fixes when this networking issue derailed things.
Once the app loads again, resume from Part 5/6 of the original testing
walkthrough: publish to Portal, redeem an invite as a family account, then
exercise the four new features (per-teacher AI settings, translation,
notification badge, trend-triggered comments) end to end.
