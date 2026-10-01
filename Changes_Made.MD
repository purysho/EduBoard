# Changes Made — EduBoard v0.7.6 “Native Mac Release Validation”

## Purpose

v0.7.6 fixes the release regression discovered after v0.7.5. Both Mac architectures
were built and uploaded, but the release workflow treated an x64 GUI launch through
Rosetta on an Apple Silicon runner as the authoritative Intel test. After renderer
sandboxing, that translated launch failed and prevented the final Mac compatibility and
checksum assets from being produced.

## Release changes

- Kept the established dual-architecture Mac build on the Apple Silicon builder.
- Kept signature and native-module checks for both arm64 and x64 packages.
- The arm64 builder now GUI-tests the native arm64 app only.
- Added a native `macos-15-intel` job which downloads the exact published
  `EduBoard-x64.zip`, extracts it, and runs the full app natively on Intel hardware.
- The native Intel test validates the shipped renderer sandbox; no `--no-sandbox`
  workaround is used.
- Added Bash syntax checking for `tools/mac/smoke-test.sh` to ordinary PR CI.

## Release recovery and completeness

Added `.github/workflows/release-repair.yml`, which runs after every Release workflow:

- downloads the exact published arm64/x64 Mac DMG and ZIP assets;
- recreates the legacy `EduBoard.dmg` alias from the published arm64 DMG;
- regenerates `SHA256SUMS-macos-latest.txt` from the exact published Mac installers;
- uploads those derived assets idempotently with `--clobber`;
- verifies the full expected 19-asset release set;
- fails explicitly when a core installer is missing instead of leaving a release that
  merely looks complete.

This finalizer also gives us a safe path to repair the already-published v0.7.5 release
without rebuilding or replacing its existing binaries.

## Review and CI

PR #39 passed:

- lint;
- TypeScript typecheck;
- Mac release-script Bash syntax check;
- desktop unit/integration tests;
- Portal tests;
- Electron E2E smoke test;
- desktop production dependency audit;
- Portal production dependency audit;
- private-content guard;
- CodeQL GitHub Actions;
- CodeQL JavaScript/TypeScript.

The aggregate CodeQL result reports **0 code-scanning annotations**.

GitHub's separate “Code scanning AI findings” job failed before code analysis because its
service requested `claude-opus-5[ReasoningEffort=medium]` and received
`400 The requested model is not supported`. No application-security finding was
produced.

## Version

**EduBoard v0.7.6 — Native Mac Release Validation**


## Post-release tooling correction

After v0.7.6 shipped successfully, recovery testing of the incomplete v0.7.5 release showed
that GitHub does not emit a fresh `workflow_run: completed` event when only failed jobs in
an existing workflow run are re-run. The v0.7.5 Mac job therefore reproduced its known
Rosetta failure but did not invoke the new finalizer.

The repair tooling now also:

- supports an explicit `workflow_dispatch` release tag;
- has a narrowly scoped main-push audit when the repair tooling itself changes;
- audits only published `v*` releases with all 17 canonical core assets and a missing
  derived Mac asset;
- keeps all repair logic in `tools/release/repair-release-assets.sh`;
- derives assets only from the exact already-published Mac binaries;
- verifies the full 19-asset set after repair;
- is syntax-checked in normal CI.

The correction passed lint, typecheck, Bash syntax checks, desktop tests, Portal tests,
Electron E2E, both production dependency audits, private-content guard, CodeQL Actions and
CodeQL JavaScript/TypeScript.

The merge is expected to trigger the narrow push audit once and restore v0.7.5's missing
`EduBoard.dmg` and `SHA256SUMS-macos-latest.txt` without rebuilding or replacing any
existing installer.
