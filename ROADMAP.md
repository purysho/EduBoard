# Roadmap

EduBoard is a desktop app for a teacher's whole working week that keeps student records
on the teacher's own computer and works offline. When the teacher chooses, it publishes
to the EduBoard Portal, where each student and family sees only their own work. The
[README](README.md) describes what it does today; the reasons behind this plan, the
competitor research and the funding roadmap are in [docs/ROADMAP_VC.md](docs/ROADMAP_VC.md).

## Already in EduBoard (v0.8.0)

So nothing below is mistaken for a future idea:

- **For teachers:** gradebook, rubrics and standards, attendance (with QR check-in),
  timetable and calendar, lesson planner with AI drafts the teacher checks, seating charts,
  exit tickets, classroom tools and presenting mode, resources library, student logs and
  parent contacts, a timeline per student, score import from a spreadsheet, report cards
  with a comment bank and AI phrase suggestions, analytics, newsletters, Word, Excel and
  PowerPoint export, automatic backups and password protection. In English and Chinese.
- **For families (the Portal):** student and family logins, grades and feedback,
  homework handed in online, report cards delivered privately with read status, notices
  with a reply slip (回执), messages with translation, a Study Helper and a weekly email.
- **For schools:** school packs (name, logo, grading scale, terms, templates), local-only
  pilot mode with the list of [what leaves the computer](docs/DATA_FLOWS.md), DingTalk and
  WeCom groups, and a privacy notice and data processing terms a school can sign.

The [CHANGELOG](CHANGELOG.md) lists every release.

## Now

- **Pilots** at three schools, in local-only pilot mode
  ([school deployment](docs/SCHOOL_DEPLOYMENT.md#a-local-only-pilot),
  [pilot agreement](docs/PILOT_AGREEMENT.md)).
- **A Windows code-signing certificate**, so installs don't trip SmartScreen
  ([code signing](docs/CODE_SIGNING.md)).
- **An update mirror reachable from mainland China.** The app already falls back to one
  when GitHub is slow; the mirror itself still has to be set up.
- **Install and update tests on real Windows and Mac computers.**

## Next (not built yet)

- Messages to chosen families with a PDF or photo attached.
- Conference booking, and forms and permission slips.
- Question-level scores and a class "most missed" list (错题本).
- Local AI as a named option (Ollama, LM Studio); today it works through the Custom
  provider.
- Bridge basics: documented import and export formats, OneRoster CSV, Google Classroom
  import.
- More Portal logins: WeChat, Alipay, Google, Apple and school single sign-on
  ([plan](docs/ROADMAP_VC.md#4-connecting-to-other-apps-and-logins)).

## Later

- Assessment providers as plug-ins, only with the school's consent.
- An optional support-plans module.
- Cover and substitutions, as part of a school plan.
- Homework help clips, a preview before the lesson, and word lists by unit.
- A hosted Portal for schools.

## Under consideration

Not scheduled, and weighed against EduBoard's local-first design: syncing a teacher's
records between their own computers, and a native phone app (the Portal already works in
a phone's browser).

## Not planned

- AI that writes whole report comments or messages: EduBoard suggests, the teacher writes.
- Hardware and IoT classrooms, and hosting video courses.
- A full school management system (admissions, billing, school-wide scheduling).
- An open API before a school or partner needs one.

Have an idea, or want to weigh in? Open an issue, or see [SECURITY.md](SECURITY.md) for a
security report.
