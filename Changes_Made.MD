# Changes Made — EduBoard v0.7.5 “Sandboxed Renderers”

## Purpose

v0.7.5 hardens the Electron renderer trust boundary without changing classroom workflows.
The main and print app-content windows now run in Chromium's renderer sandbox and expose
only EduBoard's narrow typed preload API.

## Security changes

- Enabled `sandbox: true` for main and print BrowserWindows.
- Explicitly enforced `contextIsolation: true`, `nodeIntegration: false` and
  `webSecurity: true` instead of relying on Electron defaults.
- Removed the unused generic `window.electron` bridge from `@electron-toolkit/preload`.
- Kept only EduBoard's typed `window.api` bridge plus startup UI preferences.
- Centralized app-window webPreferences so main and print windows cannot silently drift.
- Continued denying all renderer-created BrowserWindows.
- Added top-level navigation containment:
  - exact reloads of the current EduBoard document are allowed;
  - hash navigation remains unaffected for React HashRouter;
  - all other document navigation is prevented;
  - safe HTTP/HTTPS/mail destinations are handed to the system browser;
  - unsafe schemes/local-file changes stay blocked.

## Review work

Before coding:
- reviewed every BrowserWindow constructor and the preload bridge;
- checked current Electron sandbox/context-isolation/navigation guidance;
- scanned all 137 renderer TS/JS files;
- confirmed renderer code uses `window.api` and never uses `window.electron`;
- identified the deliberate `location.reload()` used by the language switch and designed
  the navigation policy so it remains functional.

The first idea—only flipping `sandbox: false` to `true`—was rejected as incomplete.
The unused broad toolkit bridge was removed first so the sandboxed preload has a smaller,
supported capability surface.

## Tests added or extended

- Unit tests for explicit BrowserWindow security preferences.
- Exact-document navigation matching tests.
- Different-file, malformed/data URL and external-link cases.
- Electron E2E now verifies the live BrowserWindow reports:
  - sandbox enabled;
  - context isolation enabled;
  - Node integration disabled;
  - web security enabled.
- E2E verifies `window.api` remains available and `window.electron` is absent.
- E2E verifies the renderer-triggered language reload still works.
- E2E verifies an unsafe top-level navigation does not replace EduBoard.

## CI and security review

PR #38 passed:
- lint;
- TypeScript typecheck;
- desktop unit/integration tests;
- Portal tests;
- Electron E2E smoke test;
- desktop production dependency audit;
- Portal production dependency audit;
- private-content guard;
- CodeQL JavaScript/TypeScript;
- CodeQL GitHub Actions.

The commit's CodeQL check reports **0 code-scanning annotations**.

The GitHub connector available in this chat does not expose the private code-scanning,
Dependabot-alert, or secret-scanning list endpoints behind the repository Security UI, so
those lists could not be enumerated directly. Their corresponding available automated
evidence above is green.

GitHub's separate “Code scanning AI findings” job again failed before analysis because
its service requested `claude-opus-5[ReasoningEffort=medium]` and received
`400 The requested model is not supported`. It produced no application-security
finding.

## Version

**EduBoard v0.7.5 — Sandboxed Renderers**
