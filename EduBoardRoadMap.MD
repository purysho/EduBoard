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
- [ ] AI-drafted report card comments extended to auto-suggest from grade+attendance
      trends — comment drafting exists for teacher, but not yet trend-triggered
- [x] Audio overview — browser-native TTS (Web Speech API), no added cost/infra
- [ ] AI-assisted homework feedback — first-pass suggestions on a submission before the
      teacher reviews — NOT yet built

## Phase 4 — Assessment depth ✅ DONE

- [x] Rubric-linked submissions — a homework assignment can link to an existing rubric;
      grading opens the same criterion-by-criterion modal as assessment rubric grading,
      writes through to the submission's grade field as "earned/max"
- [x] Simple auto-graded question types (multiple choice, short answer) for quick
      formative checks — "Quick check" questions on any assignment, graded instantly
      server-side on the Portal, no teacher review step
- [x] Grade trend analytics per student — sparkline trend chart per class on the Student
      profile page, using existing scores/assessments data (no new tables)

## Phase 5 — Operational maturity (mostly done)

- [ ] Offline-first Portal caching (PWA-style "last synced" view) — NOT built; this is a
      real architecture piece (service worker, cache strategy), not a quick add
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

- Inline translation on parent↔teacher messaging (Phase 1 item, not built)
- Portal-side (not just desktop-side) notification badges
- Digital portfolio's fuller "running record" scope (photos/files beyond graded work)
- AI comment drafting triggered by grade/attendance trends
- AI first-pass homework feedback before teacher review
