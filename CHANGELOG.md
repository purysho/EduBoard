# Changelog

All notable changes to EduBoard are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.3.3] — 2026-09-26

### Added

- **Update from inside EduBoard** (Settings → Check for updates → Update now), on Windows, Mac and Linux. It warns you to save your work, takes a backup, downloads the new version, closes, installs it and reopens. With a Portal set up, the download comes through your Portal server, which is much faster from mainland China than GitHub.
- **Start next term** (class Settings): a new class for the next term with the same setup and, if you like, the same students. They keep their Portal logins, so nobody signs up again; the new class appears for them after the next publish.
- **Edit terms** in Settings → Terms: change a term's name, school year or dates any time. Deleting a term now asks first.
- **Second backup folder** (Settings → Backups): every backup is also copied to a folder you choose (OneDrive, Baidu Netdisk, a USB stick), plus a daily backup while EduBoard stays open and a Dashboard reminder when the copy is missing or old.
- **Nightly Portal backups** on the server, kept for 14 days, set up by the updater.
- **Finished classes**: archived classes stay on the Portal read-only, so students keep their grades, feedback and materials.
- **Duplicate students**: join links match names in either order ("Chen Mai" is "Mai Chen"), and a Merge tool combines two records, Portal login included.
- **Update notice**: the Dashboard says when a newer EduBoard is out.
- **Password reset requests**: students ask from the login page; you approve on the Dashboard; they choose a new password.
- **End-of-term grade sheet**: one Excel file per course with every term, the final grade and attendance.
- **Unpublished changes reminder** on the Dashboard, with Publish now.
- **Attendance requirement** per class, with students below it listed on the Dashboard.

## [0.3.2] — 2026-09-26

### Fixed

- **macOS:** the Mac app now opens. There are two downloads, one for Apple Silicon and one for Intel Macs, each with its database and PDF components built for that chip, and both are signed (ad hoc) so Apple Silicon Macs no longer call the app "damaged". Each release now checks on a Mac that both apps start.

## [0.3.1] — 2026-09-26

### Fixed

- The macOS download is built again: the universal (Intel and Apple Silicon) app now includes the PDF reader's native files for both chips.

## [0.3.0] — 2026-09-26

EduBoard gains a student Portal: a website where students see homework, hand in work, study and message you, synced from the desktop app.

### Added

- **Student Portal** — homework, submissions, grades, messages and study material online, in English or Chinese (with AI translation of your content and read-aloud). It installs on phones like an app and works offline.
- **Joining the Portal** — one class join link (with QR code) where students type their own details, plus personal invite links per student. Nobody sees the class list.
- **AI for students** — study guides, flashcards, quizzes and a study helper. When a student uses AI on homework, you see it marked "Used AI".
- **AI for teachers** — first-pass feedback on submissions, report card comment drafts, and material generation that works on real Word/PowerPoint files. Uses Zhipu's free model, with a Test connection button.
- **Classroom** — late and missing status, auto-graded Quick Checks, bulk attendance and publishing, CSV export of submissions, student profiles with photos, and an audit log.
- **Getting started** — a self-ticking checklist on the Dashboard and a first-login tour for students.
- **Updating without a terminal** — Update-EduBoard.cmd updates the live Portal and this computer's app in one go.

### Changed

- Large classes publish reliably: attachments and study material upload separately.
- Friendlier due dates, tidier navigation and automatic fetching of submissions.

### Fixed

- Many Portal security and multi-teacher sync issues, and Windows dev-server connection errors.

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
