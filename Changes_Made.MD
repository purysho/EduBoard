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
