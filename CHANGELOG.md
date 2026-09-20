# Changelog

All notable changes to EduBoard are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.2.0] — 2026-09-20

EduBoard grows from a grade tracker into a fuller classroom operating system: communication, submissions, seating, multi-term grading, exit tickets, and a resource library.

### Added

- **Parent communication tracking** — contact-type student log entries now carry a contact method (phone/email/in-person/other) and a follow-up flag, plus a standalone **Communications** page listing every logged parent contact across all students, searchable and filterable to "needs follow-up".
- **Assignment file submissions** — attach one file per (assessment, student) pair directly from the gradebook grid; open, replace, or remove it from a small popover on the cell.
- **Seating charts** — a configurable rows × columns grid per class. Click to place a student, click an occupied seat to move them (dropping onto another student swaps the two), double-click to unseat. Shrinking the grid automatically unseats students who'd otherwise fall outside it.
- **Multi-term/annual composite grading** — link classes across terms into a "course group" (with a per-class weight) and see each student's per-term grades plus a weighted, renormalized composite on a new **Composite Grades** page.
- **Exit tickets** — a local-network-only HTTP session students join from their own device over the classroom WiFi, no internet or app install required. Teacher UI shows a QR code and live-polling responses.
- **Resources library** — a searchable, taggable library of links, files, and notes, linkable to a standard and reusable across every class.
- **Score comments** — leave a private comment on any gradebook score, visible via a hover-revealed popover.
- **Code signing (opt-in)** — `electron-builder.yml` and the release workflow are wired to sign and notarize Windows/macOS builds automatically once the relevant secrets exist (see `docs/CODE_SIGNING.md`); unsigned builds are unaffected.

### Changed

- Rubric-graded gradebook cells now participate in the spreadsheet's Enter/Arrow-key navigation, matching plain-score cells.
- Auto-backup pruning now sorts by actual file modification time instead of filename, so it always removes the genuinely oldest backups.
- The exit-ticket server's port-retry logic no longer double-logs a single port collision, and only starts logging errors once it's actually bound and serving.

### Fixed

- A grid shrink on the seating chart no longer strands students at now out-of-bounds seats.

## [0.1.1] — 2025

Initial public release: students, classes, gradebook (weighted categories, rubrics, standards), attendance, lesson planner, reports with printable PDF report cards, roster import/export, and backup/restore.
