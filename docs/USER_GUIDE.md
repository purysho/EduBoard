# EduBoard User Guide

A complete walkthrough from downloading EduBoard to running your first term with it. If you just want the short version, the [README](../README.md) covers the basics — this guide goes deeper on every screen.

## Contents

- [Installing](#installing)
- [First launch](#first-launch)
- [Creating your first class](#creating-your-first-class)
- [Adding students](#adding-students)
- [Setting up grading](#setting-up-grading)
- [Using the gradebook](#using-the-gradebook)
- [Grading with rubrics](#grading-with-rubrics)
- [Composite grading across terms](#composite-grading-across-terms)
- [Taking attendance](#taking-attendance)
- [Planning lessons](#planning-lessons)
- [Seating charts](#seating-charts)
- [Exit tickets](#exit-tickets)
- [Resources library](#resources-library)
- [Student logs and parent communications](#student-logs-and-parent-communications)
- [Reports and report cards](#reports-and-report-cards)
- [Backing up your data](#backing-up-your-data)
- [Carrying EduBoard on a USB stick](#carrying-eduboard-on-a-usb-stick)
- [Troubleshooting](#troubleshooting)

---

## Installing

Download the build for your computer from the buttons at the top of the [README](../README.md) — they always grab the current release.

### Windows

You have two options:

- **Portable (recommended for USB use)** — downloads `EduBoard-Portable.exe`. Put it anywhere (Desktop, a folder, a USB stick) and double-click it. Nothing is installed; EduBoard creates a small `EduBoard-data` folder right next to the exe the first time it runs, and that's where your database lives from then on. Copy the exe *and* that data folder together if you move to another computer.
- **Installer** — downloads `EduBoard-Setup.exe`, from the [Releases page](https://github.com/purysho/EduBoard/releases/latest). Runs a normal Windows install with a Start Menu shortcut. Your data then lives in your Windows user profile instead of next to the app.

The first time you run either one, Windows SmartScreen will likely show **"Windows protected your PC."** This happens because the build isn't code-signed (a signing certificate costs money we don't need to spend for a personal tool) — it does **not** mean anything is wrong with the app. Click **More info**, then **Run anyway**.

### macOS

Download the `.dmg`, open it, and drag EduBoard into your Applications folder (or run it straight from the mounted disk image).

The first time you open it, macOS Gatekeeper will say it **"cannot be opened because the developer cannot be verified."** Right-click (or Control-click) the EduBoard icon and choose **Open**, then confirm **Open** again in the dialog. You only need to do this once — after that it opens normally.

### Linux

Download the `.AppImage`, make it executable, and run it:

```bash
chmod +x EduBoard.AppImage
./EduBoard.AppImage
```

---

## First launch

EduBoard opens on the **Dashboard**, empty. Start in **Settings**:

- **Your name** / **School / organization** — shown on printed report cards.
- **Theme** — light, dark, or match your system.
- **Default pass mark** — pre-fills new classes; you can still override it per class.
- **Terms** (further down the Settings page) — optional. Add a term (e.g. "Term 1", school year "2026-2027") if you want to tag classes by term. Skip this if you don't need it — a class works fine with no term set.

![Settings](screenshots/settings.png)

Nothing here is permanent — all of it can be changed later, per-class settings included.

---

## Creating your first class

Go to **Classes → New class**. Fill in:

- **Class name** — whatever you'd naturally call it: "Grade 5 Homeroom", "AP English 11", "Robotics Club".
- **Level** — K-12, University, Club, or Other. This is just a label (shown as a badge) — it doesn't change what the class can do.
- **Grade level / year**, **Term**, **Schedule**, **Room** — all optional, free text.

Save, and you're on the class page with eight tabs: **Roster, Gradebook, Attendance, Lesson plans, Seating chart, Exit ticket, Report, Settings**. Every one of these is scoped to this class — grades, attendance, and lesson plans never leak between classes, but a student can be enrolled in several at once (a homeroom teacher who also runs a club, for example).

![Classes](screenshots/classes.png)

---

## Adding students

Two ways to get students into a class, both from the **Roster** tab:

1. **Enroll students → pick from your directory.** Anyone already added (in this class or another) shows up in the search list.
2. **Enroll students → + New.** Adds a brand-new student to your directory *and* enrolls them in this class in one step. Fill in first/last name at minimum — everything else (student number, grade level, guardian contact, notes) is optional and can be added later from the student's own profile page (click their name anywhere in the app).

![Roster](screenshots/roster.png)

A student's own profile page (click their name anywhere) shows their details, every class they're enrolled in with its current grade, and their log (see [Student logs and parent communications](#student-logs-and-parent-communications)).

![Student profile](screenshots/student-profile.png)

For a whole class at once, skip manual entry — see [Importing a roster](#importing-a-roster) below.

### Importing a roster

**Settings → Import a roster.** Point it at an `.xlsx` or `.csv` file with **"First Name"** and **"Last Name"** columns (a few common header spellings are recognized). It also picks up, when present: student number/ID, grade level, email, guardian name, guardian contact, notes. Optionally choose a class to enroll everyone into as they're imported — or leave that blank to just add them to your directory without enrolling anyone yet.

---

## Setting up grading

Each class has its own grading scale, in **that class's Settings tab** (not the app-wide Settings page):

- **Pass mark** and **A/B/C/D thresholds** — percentages. Below the D threshold is an F.
- **Grade categories** — e.g. "Homework" (40%) and "Exams" (60%). Optional: skip categories entirely and every assessment counts equally by points.

**How the math works:** within a category, the grade is *points earned ÷ points possible* across every graded assessment in it. The class grade blends category percentages by their weight — but only counts categories that actually have graded work yet, reweighting the rest to fill the gap. That's why a "current grade" mid-term is always the average of what's actually been entered, never zeros for work that hasn't happened.

If your weights don't add to 100%, EduBoard tells you (categories with data are renormalized automatically, but it's worth fixing).

---

## Using the gradebook

**Gradebook → + Assessment** to add a quiz, homework set, exam, or anything else you grade — name, category, date, and max score.

Enter scores directly in the grid: click a cell, type a number, click away (or press Enter) to save. Each student's live percent and letter grade show in the rightmost column, updating as you go.

![Gradebook](screenshots/gradebook.png)

Click an assessment's name in the column header to edit it, or "remove" underneath to delete it (this also deletes every score recorded for it).

**Move around the grid with the keyboard** — arrow keys jump between cells, Enter saves and moves down; this works the same whether a cell is a plain score or a rubric-graded one. Hover a cell you've already graded to reveal a small clock icon showing its change history, useful if a grade is ever disputed, and a speech-bubble icon to leave yourself a private comment on that grade.

**Attaching a submission** — hover any gradebook cell and a paperclip icon appears (it stays visible once a file's attached). Click it to attach a file from anywhere on your computer; click it again to **Replace** with a new file or **Remove** it, or click the filename to open it in your system's default app for that file type. Only one submission is kept per student per assessment — attaching a new one replaces the old, it doesn't pile up a history. EduBoard remembers where the file lives on disk rather than copying it in, so keep the original in place (or re-attach it) if you move it.

---

## Grading with rubrics

**Rubrics** (in the sidebar) is a reusable library, separate from any one class — build a rubric once and attach it to assessments in any class.

- **Rubric library tab → New rubric.** Give it a name, then add criteria (e.g. "Thesis," "Evidence"). Each criterion gets its own performance levels — a label, a point value, and an optional description (e.g. "Excellent" / 4 / "Clear, arguable thesis in the opening paragraph"). Optionally tag a criterion with one of your standards. The rubric's max score is the sum of each criterion's highest-point level.
- **Standards tab** is your own list of standards (Common Core, state, or anything you define) — just a code and description. Nothing is bundled; you add what you use.
- **Attaching a rubric to an assessment**: in **Gradebook → + Assessment**, pick a rubric from the "Grade with a rubric" dropdown. The assessment's max score locks to the rubric's total automatically.
- **Grading**: a rubric-graded assessment's gradebook cells become buttons — click one to open the rubric, pick a performance level for each criterion, and save. The total is computed automatically and shows up everywhere a normal score would — the gradebook, class report, and dashboard — no different from typing a number in.

![Rubric scoring](screenshots/rubric-scoring.png)

Editing a rubric later preserves a student's existing scores wherever the criterion or level you're editing is the same one (fixing a typo doesn't lose data); only criteria or levels you actually remove take their recorded scores with them.

---

## Composite grading across terms

If a course runs across multiple terms (Fall and Spring sections of the same class, say), you can see one student's grade across the whole thing instead of just one term at a time.

1. On each term's class, go to **Settings → Course group** and either pick an existing course group or type a name to create a new one — this is what ties "Algebra I (Fall)" and "Algebra I (Spring)" together as the same course.
2. Optionally set that class's **weight in composite** — how much this term counts relative to the group's others. Leave it at 1 to weight every linked term equally.
3. Open **Composite Grades** in the sidebar and pick the course group. You'll see every enrolled student, their percent in each linked term, and a weighted composite (with a letter grade).

![Composite grades](screenshots/composite-grades.png)

The composite is renormalized across whichever terms actually have graded work — a term that hasn't started yet doesn't drag the composite down, the same way an ungraded category doesn't drag down a single class's grade.

---

## Taking attendance

**Attendance** shows a grid: students down the side, dates across the top. Click a cell to cycle **Present → Late → Absent → Excused**. Present and Late both count as "attended"; Excused (and any day with no mark at all) is left out of the rate entirely, so a student's percentage only reflects days they were actually expected.

![Attendance](screenshots/attendance.png)

Today's date is there by default — add more with the date picker and **+ Add date** as the term goes on.

---

## Planning lessons

**Lesson plans** is a running list, newest additions included. Each entry has a date, status (Planned / Taught / Skipped), title, objectives, materials, activities, homework, and an optional link to one of the class's assessments (handy for tracing which lesson a quiz grew out of). Nothing here is required — use as much or as little structure as is useful to you.

---

## Seating charts

**Seating chart** (per class) is a grid you lay out yourself — set **Rows** and **Columns** at the top to match your actual room.

- **Placing a student**: click a name in the **Unseated** list on the left, then click an empty seat to place them there.
- **Moving a student**: click their occupied seat (it highlights as selected), then click the seat you want to move them to. If that seat is already taken, the two students swap places — nobody gets bumped to "unseated" by accident.
- **Unseating a student**: double-click their seat directly, or click it once to select them and don't click a destination.
- **Shrinking the grid**: if you reduce Rows or Columns and a student's seat falls outside the new size, they're automatically moved back to the Unseated list rather than left stuck in a seat you can no longer see.

![Seating chart](screenshots/seating-chart.png)

The layout is saved per class automatically — no separate save step.

---

## Exit tickets

An exit ticket is a quick 1–3 question check students answer on their own device (phone, tablet, laptop) over the classroom WiFi — no internet connection, app install, or account needed on their end.

1. **Exit ticket** (per class) → write up to 3 questions (short answer or multiple choice) and **Save**.
2. **Start session** — EduBoard starts a small local server and shows a QR code plus a web address. Students on the same WiFi scan the QR code or type the address into their browser.
3. Students fill in their name and answers and submit. Responses appear in the **Responses** list live (it polls every few seconds while the session is open).
4. **Stop session** when you're done; **Clear** wipes the recorded responses if you want to reuse the same questions with another class.

![Exit tickets](screenshots/exit-tickets.png)

Because everything happens over your local WiFi rather than the internet, this works in classrooms with no outside network access — the only requirement is that the teacher's computer and students' devices share the same WiFi network. If a student's device shows "no exit ticket is open," check that the session is still started and that they're on the same network as the teacher's computer.

---

## Resources library

**Resources** (sidebar) is a searchable library of lesson links, files, and notes — not tied to any one class, so you build it up once and reuse it everywhere.

- **New resource** → choose a type (**Link**, **File**, or **Note**), give it a title, and fill in the URL or pick a file from your computer (for File) or just write the note (for Note). Add tags (comma-separated) and, optionally, one of your standards to make it easy to find later.
- Filter by typing in the search box or clicking a tag chip; click a link or file resource to open it in your browser or default app, or click a note to view/edit it.
- Files are referenced by their path on disk, the same as gradebook submissions — keep the original file where EduBoard can find it.
- **Study tools (needs an AI key in Settings):** click **Index for Notebook** first. Then **Study guide**, **Flashcards** and **Practice quiz** each draft a study aid from the resource's text. Flashcards and quizzes open in a review window where you can read every card and question (the correct answer is ticked) and **Regenerate** or **Remove** them. If the resource is shared with a class, students get them on the Portal to practise with; the practice quiz is self-checked and never counts toward a grade.

![Resources library](screenshots/resources.png)

---

## Student logs and parent communications

Every student's profile page has a **Log** — quick-add buttons for common entries (missed homework, great participation, called home, emailed guardian) plus a free-text note with a type: **Note**, **Positive**, **Concern**, or **Contact**.

A **Contact** entry is a parent-communication record: pick how you reached them (**Phone**, **Email**, **In person**, **Other**) and, if it needs a follow-up, check **Needs follow-up**. Once you've followed up, click **Mark follow-up done** on that entry (from either the student's profile or the Communications page below).

**Communications** (sidebar) rolls up every Contact entry across every student into one searchable list — search by student name or note text, or filter to just the ones still needing follow-up. Each entry links back to that student's profile.

![Parent communications](screenshots/parent-communication.png)

---

## Reports and report cards

**Report** (per class) shows:

- Class average, pass rate, and average attendance as headline numbers.
- Grade distribution (how many students landed in each letter grade).
- Category averages (which part of the grade the class is strongest/weakest in).
- An attendance trend line once there's more than one date recorded.
- **Export gradebook (.xlsx)** — every assessment, every score, and the computed grade, as a spreadsheet you can open in Excel or hand to an administrator.
- **Print PDF** next to each student's name — a one-page report card (grade, category breakdown, every assessment score, attendance summary) rendered straight to PDF, no extra software needed.

![Class report](screenshots/class-report.png)

The **Dashboard** rolls all of this up across every class at once — total students, overall average, pass rate, attendance, and what's coming up in your lesson plans.

![Dashboard](screenshots/dashboard.png)

---

## Backing up your data

**Settings → Backups → Back up now** makes a timestamped copy of your entire database. Do this before anything you'd hate to redo (a big import, end of term) — it takes a second. **Open folder** shows you where backups live on disk, so you can copy one to a USB stick, a cloud-synced folder, or email it to yourself.

**Restore** replaces everything currently in EduBoard with a chosen backup and restarts the app — use it if something goes wrong or you're setting up on a new computer from an old backup.

There's no auto-sync or cloud anything here on purpose: EduBoard doesn't talk to the internet at all. Backups are the whole safety net, so it's worth actually using them.

---

## Carrying EduBoard on a USB stick

This is what the **portable** Windows build (and, less formally, the macOS `.app` or Linux AppImage) is for:

1. Copy `EduBoard-Portable.exe` (or the `.AppImage`, or the extracted `.app`) onto the USB stick.
2. Run it once from the stick — it creates its data folder right there next to itself.
3. From then on, plug the stick into any compatible computer and run the exe directly off it. Your classes, students, grades, and attendance travel with it, no install needed on the host machine.

Two things worth knowing:
- Writing to a USB stick is slower than a local disk, so very large rosters may feel a little less snappy — fine for typical class sizes.
- Back up periodically (see above) — a lost or corrupted USB stick is the one single point of failure in this setup, same as it would be for any file you keep only on a flash drive.

---

## Troubleshooting

**Windows says "Windows protected your PC" / macOS says the app "cannot be opened."**
Expected — see [Installing](#installing) above. It's a code-signing warning, not a real error.

**I imported a roster and some students didn't show up.**
Check the import result message: rows missing a first *and* last name are skipped and reported, not silently dropped. Fix the source file and re-import — duplicate students aren't automatically merged, so check your directory for repeats if you import the same file twice.

**A student's grade shows "—" even though I entered scores.**
Grades only compute once a category (or the whole class, if you're not using categories) has at least one graded assessment. If you're using categories, an assessment must be assigned to one for it to count toward category-weighted totals — assessments left "Uncategorized" still count, just folded in unweighted.

**I want to move EduBoard's data to a different computer.**
Use **Settings → Backups**, make a fresh backup, copy the `.db` file to the new machine (or the new machine's version of EduBoard), and use **Restore** to load it. For the portable build, it's simpler still: just copy the exe and its `EduBoard-data` folder together.

**Something looks broken.**
Please open an issue on the [GitHub repo](https://github.com/purysho/EduBoard/issues) with what you were doing and what you expected instead — screenshots help a lot.
