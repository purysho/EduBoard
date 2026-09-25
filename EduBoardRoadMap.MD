# EduBoard Roadmap (Portal era)

Six phases, as scoped with the user. Status notes reflect what's actually been built
and pushed to `v0.3-dev` as of this file's creation — update as phases progress.

## Phase 1 — Core loop completion ✅ DONE

- [x] Real student submissions (file/text) with teacher grading + written comments
- [x] Topics/units to group homework by week/unit
- [x] Class Story feed (teacher posts, all parents see)
- [x] 1:1 parent↔teacher messaging — inline translation NOT yet built
- [x] Notification badges (new grade/message/homework) on the Portal — unread-message
      badge shipped on the desktop Sidebar; Portal-side badges not yet built

## Phase 2 — Engagement & retention ✅ DONE

- [x] Reuse post/assignment across classes and terms — assignment reuse shipped;
      cross-class reuse works since the reused assignment can be re-targeted to any class
- [x] Digital portfolio — teacher-starred graded submissions, shown to families;
      running-record-over-the-year framing (photos/files/notes beyond graded work) is a
      lighter version of what was described — worth revisiting for full scope
- [x] Parent digest email — weekly SMTP-based summary, opt-in via email on file
- [x] Calendar view — month grid of homework due dates across all classes
- [x] Multi-child support surfaced in Portal UI — one login, one dashboard, all linked
      students shown (already worked structurally, now confirmed in the UI)

## Phase 3 — AI-native differentiators ✅ DONE

- [x] Student-facing Notebook AI (chat with materials, citations) — Zhipu GLM-4-Flash
      free-tier shared key model
- [x] Auto-generated study guides/summaries per resource
- [x] AI-drafted report card comments extended to auto-suggest from grade+attendance
      trends — "Draft comment" now feeds the AI a trend direction (improving/declining/
      steady, computed from first-to-most-recent scored assessment) alongside grade and
      attendance, and the Trend column shows a Declining/Improving badge when a class's
      swing crosses 8 points so a teacher notices before drafting a comment at all
- [x] Audio overview — browser-native TTS (Web Speech API), no added cost/infra
- [x] AI-assisted homework feedback — see "Classroom + NotebookLM gaps" below

## Phase 4 — Assessment depth ✅ DONE

- [x] Rubric-linked submissions — a homework assignment can link to an existing rubric;
      grading opens the same criterion-by-criterion modal as assessment rubric grading,
      writes through to the submission's grade field as "earned/max"
- [x] Simple auto-graded question types (multiple choice, short answer) for quick
      formative checks — "Quick check" questions on any assignment, graded instantly
      server-side on the Portal, no teacher review step
- [x] Grade trend analytics per student — sparkline trend chart per class on the Student
      profile page, using existing scores/assessments data (no new tables)

## Phase 5 — Operational maturity ✅ DONE

- [x] Offline-first Portal caching (PWA-style "last synced" view) — installable PWA
      (manifest + icon), a service worker caches the app shell so the page loads at all
      offline, and a separate page-level Cache Storage layer caches API GET responses
      with a "Viewing saved data — last synced [time]" banner when serving from cache.
      Deliberately two layers (not one SW doing everything) so the page itself can tell
      "fresh" from "cached" and never silently show stale data as if it were live.
- [x] Audit log / activity history — new Audit Log page tracks students, classes,
      enrollments, grades, attendance, homework assignments (incl. publish/unpublish),
      and submission grading. A removed student's trail disappears from view immediately
      but is kept 12 months (auto-purged) — a full backup is also taken right before any
      student deletion as the real recovery mechanism.
- [x] Bulk actions — "Mark all present" per date on the Attendance tab, "Publish all N
      drafts" on the Homework tab. Grade curves not built (no curve-application UI exists
      anywhere yet, not just as a bulk action).
- [x] CSV/PDF export of anything — gradebook (.xlsx) and attendance (.csv) already
      existed; added homework submissions (.csv). PDF export = the existing per-student
      print report.
- [x] Multi-teacher support — the Portal is now genuinely multi-tenant: each teacher gets
      their own sync secret (minted via a new admin API) and only ever sees their own
      classes/students/grades/homework/invites; verified with a live two-teacher test
      (isolated pushes, no cross-contamination). The desktop app itself is unchanged —
      "Portal sync secret" in Settings is just that teacher's own credential now. Backward
      compatible: an existing single-teacher Portal auto-seeds a "Default teacher" from
      its current SYNC_SECRET on first boot after upgrading, so nothing breaks.
      **Known gap:** the AI provider/key and digest SMTP settings are still one shared
      config for the whole Portal, not per-teacher — documented in portal/README.md.
      Messages are scoped to accounts with at least one of a teacher's own students, but
      aren't fully partitioned if one family has children under two different teachers
      on the same Portal (rare edge case, noted in code).

## Phase 6 — Platform-level (seeded by Phase 5's multi-teacher work)

- [x] School-level admin view — minimal version: `POST/GET/DELETE /api/admin/teachers`
      (secured by ADMIN_SECRET) creates teachers, mints their sync secret, and lists
      everyone on the Portal with a rough class/student count each. Not a UI/dashboard —
      curl or a future admin page would call this API.
- [ ] Marketplace/library of shareable lesson plans and activities between teachers
- [ ] Behavior tracking (ClassDojo-style) as an optional module

## Known gaps carried forward

- Digital portfolio's fuller "running record" scope (photos/files beyond graded work)
- Messages still aren't fully partitioned if one family has children under two
  different teachers on the same Portal (rare edge case)

## Security hardening before real student use

- [x] Rate limits: login (per IP and per username), invite/QR secret URLs, sync/admin
      secret guessing (failures only), per-student AI burst + daily caps
- [x] Constant-time admin secret check; bcrypt timing equalised for unknown usernames
- [x] Portal page escapes every teacher-, student- and AI-supplied string. AI study
      guides and chat replies were rendered as raw HTML, a stored-XSS risk
- [x] Logout and any 401 clear the offline cache, so a shared computer never shows the
      previous student's data
- [x] Student self-service password change; a change or teacher reset signs out every
      session. Teacher reset is now a button in desktop Settings (was curl-only)
- [x] Security headers, loopback-only proxy trust, JSON errors without stack traces,
      20 MB submission cap, minimum password length, `PORTAL_DATA_DIR`
- [x] Portal test suite (`portal/test`, 20 tests) running in CI

## Classroom + NotebookLM gaps (this pass)

- [x] Late / Missing status — a due date ends at midnight in the teacher's own time zone
      (sent on publish). Students see Late/Missing labels on the Portal; the desktop
      submissions list shows the same, with a missing/late count per assignment
- [x] AI first-pass feedback — "Draft with AI" on a submission fills the grade and
      feedback boxes (reads the written answer and PDF/text attachments, grades against
      the rubric if linked). Saves nothing until the teacher does; flags blank work,
      unreadable files and attempts to instruct the grader
- [x] Flashcards and practice quizzes per resource — drafted on the desktop, reviewed in
      a window with Regenerate/Remove, published with shared resources; students flip
      cards and self-check the quiz on the Portal (no per-student AI cost)
- [x] Portal admin page (`/admin.html`) — add, list and remove teachers
- [x] Security fix: a student's upload name could make the desktop save outside its
      download folder, and executables were opened directly. Names are now reduced to a
      safe base name and only document/media types open directly
- [ ] School single sign-on — depends on which identity provider a school uses
      (deferred: invite codes are enough for now)

## Student profiles and upload safety

- [x] Student profiles on the Portal: photo, preferred name, pronouns, about me, date of
      birth, learning goals, "anything my teacher should know", preferred language,
      private notes. Teacher sees them on the desktop student page, minus private notes
      and minus the birth year (birthday only if the student opts in)
- [x] Profile photos: JPEG/PNG/WebP only, content-checked, decompression-bomb limit,
      re-encoded to 512×512 WebP (strips EXIF/GPS and hidden payloads)
- [x] Uploads checked by content on the Portal and again on the desktop before opening:
      disguised programs, macro-enabled Office files and RTF embedded objects refused;
      Windows downloads get Mark of the Web (Office Protected View)

## Post-roadmap additions (this pass)

- [x] Inline translation on parent↔teacher messaging — either side can translate a
      message on demand via the teacher's own AI key, cached per message+language
- [x] Portal-side notification badge — poll-based unread-message pill + tab-title count
- [x] AI key / digest SMTP settings made genuinely per-teacher (were a shared row)
- [x] AI-drafted report card comments now trend-triggered (see Phase 3 above)
