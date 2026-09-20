# Security Policy

## Supported versions

EduBoard is a single-user desktop app with no built-in update mechanism — only the
latest release is supported. If you find a security issue, please update to the
[latest release](https://github.com/purysho/EduBoard/releases/latest) first and confirm
it's still reproducible there before reporting.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security vulnerability. Instead, use
[GitHub's private vulnerability reporting](https://github.com/purysho/EduBoard/security/advisories/new)
for this repository (Security tab → Report a vulnerability). This opens a private
conversation with the maintainer rather than a public issue.

Include, where relevant:

- What version of EduBoard you're running, and your OS.
- Steps to reproduce, or a minimal example.
- What you'd expect to happen instead.

## Scope and context

EduBoard is a local-first, offline desktop app: it has no server, no account system, and
does not transmit data over the network on its own (the one exception is the optional
**Exit ticket** feature, which starts a small HTTP server bound to your local network so
students' devices on the same classroom WiFi can submit responses — it's never reachable
from the internet, and is off unless a teacher explicitly starts a session).

Given that scope, the security issues most worth reporting are things like:

- A way to read or write files outside the app's own data directory.
- A way for the exit-ticket local server to be reached or exploited from outside the
  local network it's bound to.
- Anything that would let imported data (a roster `.xlsx`/`.csv`, a restored backup)
  execute code rather than just populate the database.

General bugs, feature requests, and UI issues belong in the
[issue tracker](https://github.com/purysho/EduBoard/issues) instead.
