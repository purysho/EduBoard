# Security Policy

A plain-language overview of how EduBoard protects student data, for a school's IT or
data protection review, is at **https://edu-board.com/security** (English and Chinese),
with the [privacy notice](https://edu-board.com/privacy) and the
[data processing terms](https://edu-board.com/data-processing) beside it.

## Supported versions

Only the latest release is supported. The desktop app updates itself (it downloads new
versions in the background, verifies the installer against the SHA-256 digest published
with the GitHub release, verifies it again immediately before execution, and installs it
the next time EduBoard opens), and a Portal is updated with
`portal/scripts/update-server.sh`. Please check that an issue still happens
on the [latest release](https://github.com/purysho/EduBoard/releases/latest) before
reporting it.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security vulnerability. Use
[GitHub's private vulnerability reporting](https://github.com/purysho/EduBoard/security/advisories/new)
(Security tab → Report a vulnerability), or write to privacy@edu-board.com.

Include, where relevant:

- The EduBoard version (desktop app or Portal) and your system.
- Steps to reproduce, or a minimal example.
- What you'd expect to happen instead.

Please don't test against other people's accounts or data, including on
portal.edu-board.com; run a Portal locally (`portal/scripts/local-test.js`) instead. The
public demo login (username `demo`) is shared, so leave it usable for others.

## Scope and context

EduBoard has two parts:

- **The desktop app** keeps a teacher's data in a database on their own computer. It
  connects to the network only for what the teacher sets up: publishing to their Portal,
  AI suggestions with their own key, DingTalk / WeCom group posts, update checks, and an
  anonymous weekly count that is off unless turned on. The **Exit ticket** feature runs a
  small HTTP server on the classroom network while a session is open. With **password
  protection** on, the database and its backups are encrypted with a random key
  (ChaCha20-Poly1305, via SQLite3 Multiple Ciphers / `better-sqlite3-multiple-ciphers`);
  that key is stored next to the database only wrapped (AES-256-GCM, scrypt) by the
  teacher's password and by a one-time recovery key.
- **The Portal** (`portal/`) is a Node/Express server where students and families sign
  in. It holds what teachers publish and what families add, behind bcrypt passwords,
  signed session cookies, per-family access checks on every request, rate limits and
  upload content checks. `portal/scripts/harden-server.sh` sets up the server around it
  (firewall, fail2ban, automatic security updates, the service as its own sandboxed user,
  optional key-only SSH).

The shipped packages of both parts are checked with `npm audit` on every push and every
week (`.github/workflows/dependency-check.yml`), and Dependabot proposes updates.

The issues most worth reporting:

- A way for one family or student to see or change another's data on the Portal, or for
  one teacher to reach another teacher's classes.
- A way around sign-in, session, rate-limit or upload checks on the Portal.
- A way to read or write files outside the app's or the Portal's own data folders.
- A way for the exit-ticket server to be reached or exploited from outside the classroom
  network.
- Anything that would let imported data (a roster or score spreadsheet, a school pack, a
  restored backup) run code rather than just fill in the database.

General bugs, feature requests and UI issues belong in the
[issue tracker](https://github.com/purysho/EduBoard/issues).
