# Changes Made — EduBoard v0.7.8 “Lean Core”

## Teacher workflow

- Upgraded the existing Dashboard Today card into a current/next-lesson action area.
- The class happening now, or the next class of the day, is promoted with direct links to:
  - attendance;
  - lesson planning;
  - classroom tools / Classroom Hub.
- The complete daily timetable remains visible underneath.
- Added deterministic shared tests for current/next lesson selection.

## Term rollover and teacher handover

- Kept the existing transactional next-term workflow as the source of truth.
- Added **Export handover pack** for the classes currently selected in the rollover modal.
- Handover ZIPs contain:
  - class setup;
  - term/course labels;
  - grading categories;
  - timetable;
  - active student names;
  - seating positions;
  - lesson dates/titles/statuses and summary counts.
- Handover exports deliberately exclude:
  - grades;
  - attendance history;
  - guardian contacts;
  - student notes;
  - student email/number;
  - passwords;
  - API keys / Portal secrets;
  - submissions.
- Added an integration test that opens the generated ZIP and proves those private fields are absent.

## Lean packaging

- Restricted packaged Electron locales to English (US/GB) and Simplified Chinese.
- Explicitly excluded repository-only material from the desktop package:
  - docs;
  - Portal source/public site;
  - development tools;
  - GitHub workflow files;
  - root roadmap/handoff Markdown and helper command files.
- Moved renderer-only libraries from runtime dependencies to dev dependencies so electron-builder does not separately collect them after Vite already bundles them:
  - React;
  - React DOM;
  - React Router;
  - TanStack Query;
  - Lucide;
  - Recharts;
  - clsx.
- No native runtime dependency was bundled, replaced or removed.

## Permanent anti-bloat controls

- Added `tools/package-size/report.mjs` with no external dependency.
- Reports:
  - total built bytes;
  - renderer JavaScript;
  - main/preload JavaScript;
  - packaged node_modules when present;
  - app.asar when present;
  - locales;
  - production dependency count;
  - largest files.
- Added conservative committed size budgets.
- Electron E2E CI now runs the size budget after the real Vite build.
- Windows installer CI logs packaged dist composition for release-size tracking.

## Release reliability

- Folded the release-finalizer correction into the main Release workflow.
- Release completeness/derived Mac asset verification now runs inside the Release workflow itself instead of relying on a second workflow_run chain.
- Historical/manual release repair remains available separately.

## Version

**EduBoard v0.7.8 — Lean Core**


## Measured release impact

Compared with v0.7.7, v0.7.8 reduced the actual published packages without removing features:

- Windows Setup: **126.34 → 114.49 MiB (-9.38%)**
- Windows Portable: **126.19 → 114.33 MiB (-9.40%)**
- Linux AppImage: **192.32 → 181.08 MiB (-5.84%)**
- macOS arm64 DMG: **191.08 → 170.59 MiB (-10.72%)**
- macOS x64 DMG: **197.52 → 177.00 MiB (-10.39%)**

The Mac ZIPs fell by roughly 20.74 MiB each as well. All 19 release assets were published successfully and retain SHA-256 digests.

The normal Electron build now establishes a permanent baseline of **3.63 MiB compiled output** and **11 production dependency declarations** so future growth becomes visible in CI.


## Post-release CI follow-up

The v0.7.8 Windows installer itself built and published correctly. The first post-merge test-build run failed only at its final unauthenticated GitHub updater-download check. PR #48 made that CI check deterministic by passing the workflow's ephemeral GitHub token to the existing updater test; this does not change public teacher update behavior. The complete workflow was then rerun successfully, including the final `Update-EduBoard` download validation.

The packaged Windows composition report also established:
- `app.asar`: **122.58 MiB**;
- packaged unpacked node_modules: **67.86 MiB**;
- Electron locales: **1.68 MiB / 3 files**;
- 11 production dependency declarations.


## Final CI hardening

- PR #50 replaced the shared-runner updater API probe with authenticated `gh release download` verification for the `test-latest` installer.
- CI now verifies the downloaded test installer matches the just-built file by **both byte size and SHA-256**.
- Final verification: **120,047,912 bytes**, SHA-256 `97A4355CCDD07D4E8BC8FE3853A24CA72D41AB4CE2731099DE402380F5B159F4`.
- The teacher-facing updater remains unchanged and continues to support public/tokenless GitHub downloads with optional token and retry behavior.
