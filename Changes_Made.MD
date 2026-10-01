# Changes Made — EduBoard v0.7.7 “Trusted IPC Boundary”

## Purpose

v0.7.7 adds an independent trust boundary around renderer-to-main IPC. Sandboxing and
navigation containment already reduced renderer risk, but privileged IPC handlers now
also verify who sent each request before any arguments reach EduBoard services.

## Security changes

- Added a central IPC sender validator for app and print windows.
- Each EduBoard-created WebContents is registered against one exact renderer document.
- Every asynchronous typed IPC request now requires:
  - a registered EduBoard WebContents;
  - a live, attached sender frame;
  - the WebContents main frame rather than an iframe/child frame;
  - the exact registered app document, ignoring only hash routing.
- The synchronous boot-time `i18n:prefs` channel uses the same validation and returns no
  UI settings to an untrusted sender.
- Added `EB-0006` for rejected async IPC requests and a Chinese translation.
- Removed the unused `@electron-toolkit/preload` runtime dependency.

## Regression coverage

Added sender-validation tests for:
- packaged and development app documents;
- hash-only route changes;
- unknown WebContents;
- child frames;
- missing, destroyed and detached frames;
- registered windows that have navigated to another document.

Existing Electron E2E continues to prove the sandboxed preload and typed `window.api`
operate normally.

## Review and CI

The first full PR gate passed:
- lint;
- TypeScript typecheck;
- release-script syntax/regression checks;
- desktop unit/integration tests;
- Portal tests;
- Electron E2E;
- desktop and Portal production dependency audits;
- private-content guard;
- CodeQL GitHub Actions;
- CodeQL JavaScript/TypeScript.

Aggregate CodeQL reported 0 code-scanning annotations. GitHub's optional AI-security
service check again failed outside application analysis and produced no app finding.

## Release-tooling prerequisite

Before this release, v0.7.5's two missing derived Mac assets were restored from its exact
published binaries, returning that release to 19 assets. A cleanup-trap bug discovered
after successful repair was fixed with a subshell-scoped cleanup and a mocked-GitHub
idempotency regression test; the subsequent no-op repair workflow exited green.

## Version

**EduBoard v0.7.7 — Trusted IPC Boundary**
