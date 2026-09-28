# Performance at school scale

Two repeatable checks, one for each half of EduBoard. Both were run on a 4-core
2.8 GHz cloud machine (September 2026); a school laptop will be slower in
absolute terms, but the proportions hold.

## A heavy teacher's year in the desktop app

`tools/perf/teacher-year.mjs` seeds a full year for one busy teacher and times the
calls the window makes in the background and how long each screen takes to show:

- 12 classes of 50 students (600 students)
- 60 marked assessments per class (36,000 marks)
- 180 school days of attendance (108,000 records)
- a lesson plan for every day (2,160)

```
npx electron-vite build && xvfb-run node tools/perf/teacher-year.mjs
```

(`CLASSES`, `PER`, `ASSESS`, `DAYS` and `PLANS` change the sizes; `KEEP=<folder>`
reuses a data folder from an earlier run, since seeding takes a couple of minutes.)

| | Before | After |
|---|---:|---:|
| Unpublished-changes check (runs every 30 s) | 12,800 ms, freezing the app | 2 ms (0.7 s after a change) |
| Gradebook (50 students × 60 assessments) | 4,400 ms | 900 ms |
| Attendance | 1,400 ms | 180 ms |
| Your week | 1,400 ms | 700 ms |
| Dashboard | 2,000 ms | 530 ms |
| Every other screen | | under 400 ms (audit log 800 ms) |

What changed:

- The unpublished-changes check recalculated each class's attendance once per
  student. It now reads each class once, and keeps its answer until something is
  written to the database.
- Each of the gradebook's 3,000 cells carried its own save, history, comment and
  submission logic; those now exist only for the one popover that's open.
- Attendance opens on the last 15 days (today in view) rather than all 180 columns.
- Reports read each class's marks and attendance once rather than once per student,
  and attendance rates are counted by SQLite.

That year's database is 115 MB, over half of it the audit log (every mark and
attendance entry is recorded). Automatic backups keep ten copies: the three newest and
the newest of each earlier day, so a mistake found a week later can still be undone.

## One Portal for a whole school

`portal/scripts/load-test.js` starts a Portal and has a school use it:

- 100 teachers, each publishing 4 classes of 45 students with 30 marked assessments a
  class (18,000 students' records, 500 KB per publish)
- 300 families signing up through personal invite links, then opening their pages
- 20 teachers publishing at the same moment while families keep loading pages

```
cd portal && node scripts/load-test.js
```

| | Result |
|---|---:|
| A teacher's publish | median 45 ms, worst 107 ms |
| A family's home page | median 3 ms, 95th percentile 4 ms |
| 20 teachers publishing at once | all done in 1.2 s |
| A family's page during that | median 74 ms, worst 1.0 s |
| Database | 54 MB |

The Portal does its database work on one thread, so a burst of simultaneous publishes
briefly queues other requests; in practice publishes are spread through the day (each
teacher's app publishes a couple of seconds after an edit).

The same test found that a class signing up together over a school's one internet
address hit the per-address limits (60 invite requests, 50 logins per 15 minutes). Now
only failed logins count toward the address's limit (100), and invite and QR links allow
300 per 15 minutes; their codes carry about 60 random bits, so neither can be guessed.
All limits can be changed in the Portal's `.env` ([portal/README.md](../portal/README.md)).
