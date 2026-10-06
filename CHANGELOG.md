# Changelog

All notable changes to EduBoard are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.7.9] — 2026-10-06

### Added

- **Class teaching profile for AI drafts:** each class has a short profile in the teacher's own words (level, lesson shape, use of the first language, routines, what to avoid). Every AI lesson draft for the class follows it, and it carries into a new term.
- **Class evidence in lesson drafts:** drafts build on the class's recent record: the last lessons, speaking-ladder marks, recent assessment averages and exit-ticket questions that suggested re-teaching. Counts and the teacher's own titles only; no student is named.
- **Plan a unit with AI:** prerequisites first, then a sequence of lessons with aims and an end-of-lesson check each. The lessons go on the class's next free timetable days, labelled with the unit, as outlines or each drafted in full from the unit.
- **Floor and stretch in every AI lesson draft:** the support and stretch versions of the main task are filled in.
- **Study Helper knows what the student finds hard:** a nameless summary of the cards and quick-check questions they keep missing and their week's goal, sent as data.
- **Study Helper settings:** students describe their level in their own words and choose hint strength and reply language; teachers set per-class rules (reply language, vocabulary level, own rules) in the desktop app, which reach the Portal with the next publish and come first.
- **"Make me a revision plan"** on the Portal's week plan: a few timed tasks a day from the student's homework, review cards and weak spots, kept until it's over or cleared.

### Fixed

- Study-progress returns not linked to a student are now included in that student's data export and erased with them.
- Copying homework to several classes is all-or-nothing.
- Test builds retry publishing when the upload fails.
- AI lesson and unit drafts read replies with a sentence around the JSON or a list where text was asked for, and report failures in plain words; Portal revision plans keep tasks sent as plain text.
- A test of the encrypted key file no longer fails one run in 256.

### Security

- Build tools: `http-cache-semantics` 4.3.0 (Dependabot alert: shared-cache Set-Cookie leak) and `source-map-js` 1.2.2. Neither is in the installed app or the Portal. Remaining moderate findings in electron-builder's download chain need electron-builder 27.

### Privacy

- The privacy notice and data-processing terms (EN/ZH) describe what the Study Helper and revision plans send to the AI provider.

## [0.7.8] — 2026-10-01

### Added

- **Today / Next Lesson actions:** the Dashboard now promotes the class happening now, or the next class of the day, with direct links to attendance, the lesson plan and classroom tools while retaining the full daily timetable.
- **Teacher handover packs:** the existing end-of-term workflow can export the selected classes as a portable ZIP containing class setup, active student names, timetable, seating, grade categories and lesson-plan dates/titles/statuses. Grades, attendance history, guardian contacts, private notes, passwords, secrets and student submissions are deliberately excluded.
- **Package composition report:** a dependency-free tool reports built bundle size, renderer/main/preload JS, packaged node_modules, locales, app.asar when present, production dependency count and largest files.
- **CI size budgets:** normal Electron CI now rejects substantial bundle/dependency growth rather than allowing silent bloat.

### Changed

- **Leaner desktop package:** repository-only docs, Portal source, development tools/workflows and handoff/roadmap files are explicitly excluded from the installed desktop application.
- **Fewer Chromium locales:** packaged Electron keeps English (US/GB) and Simplified Chinese locales instead of every Electron locale.
- **Renderer dependencies no longer ship twice:** React, React DOM, React Router, TanStack Query, Lucide, Recharts and clsx are renderer-build dependencies rather than production node_modules; Vite continues to bundle them into the renderer.
- **Release completeness is inline:** the Release workflow itself now runs the idempotent repair/completeness verifier after platform builds and native Intel Mac validation, removing reliance on a second workflow being auto-triggered by repository automation.

### Tests

- Added deterministic current/next lesson selection tests.
- Added an integration test that opens the handover ZIP and verifies sensitive student/contact fields are absent.
- Existing desktop, Portal, E2E, release-repair, dependency and CodeQL gates remain required.

## [0.7.7] — 2026-10-01

### Security

- **Trusted IPC boundary:** every asynchronous renderer-to-main request is now rejected unless it comes from an EduBoard-created WebContents, its live main frame, and the exact renderer document registered for that window.
- **Synchronous bootstrap protection:** the pre-render `i18n:prefs` request uses the same sender validation and returns no settings to an untrusted frame.
- **Independent trust checks:** IPC authorization no longer relies only on navigation blocking; window identity, main-frame identity, and document identity are checked at the IPC boundary itself.
- **Narrower runtime dependencies:** removed the unused `@electron-toolkit/preload` package after v0.7.5 eliminated its last generic Electron bridge.

### Tests

- Added sender-validation coverage for unknown windows, child frames, missing/destroyed/detached frames, unexpected documents, development URLs, and hash-only routes.

## [0.7.6] — 2026-10-01

### Fixed

- **Native Intel Mac release validation:** Intel builds are now GUI-tested on GitHub's native `macos-15-intel` runner instead of treating a Rosetta launch on Apple Silicon as the target environment.
- **Partial Mac release recovery:** a post-release finalizer recreates the legacy `EduBoard.dmg` compatibility asset and macOS checksum file from the exact published Mac installers, then verifies the complete expected asset set.
- **v0.7.5 release regression:** the release pipeline no longer stops before derived Mac assets merely because a translated Rosetta GUI smoke test disagrees with the native target environment.

### Security

- Renderer sandboxing remains enabled during native arm64 and native Intel GUI release tests; the release pipeline does not use `--no-sandbox` to bypass validation.

## [0.7.5] — 2026-10-01

### Security

- **Sandboxed app renderers:** the main and print windows now explicitly use Chromium's renderer sandbox, context isolation, no Node.js integration and web security.
- **Narrower preload bridge:** removed the unused generic `window.electron` bridge; renderer code receives only EduBoard's typed `window.api` and startup UI preferences.
- **Navigation containment:** renderer-created windows remain denied, and top-level document navigation is blocked unless it is an exact reload of the current EduBoard document. Safe HTTP/HTTPS/mail links are handed to the system browser instead of replacing the app.
- **Shared window policy:** main and print windows now use one central security configuration so later window changes do not silently drift apart.

### Tests

- Added pure navigation-policy tests covering same-document reloads, different files/paths, external links and malformed URLs.
- Extended Electron smoke testing to verify the live BrowserWindow security preferences, absence of `window.electron`, continued `window.api` functionality, allowed language-switch reloads and blocked unsafe navigation.

## [0.7.4] — 2026-09-30

### Security

- **Verified automatic updates:** EduBoard now checks every downloaded installer against the SHA-256 digest GitHub publishes for that release asset, not only its byte size, and rejects/deletes a same-size file whose content differs.
- **Verify again before execution:** a pending installer is hashed again immediately before automatic startup installation or a teacher-triggered restart-and-update, detecting modification after download.
- **Verified Portal relay metadata:** the Portal now carries GitHub's release digest through its update API so teachers whose app reaches GitHub through the Portal receive the same integrity check.

### Fixed

- Corrupt or unreadable pending-update metadata is cleared on launch instead of being rediscovered forever.
- Release and pending-update digests are normalized and validated before use; malformed or missing integrity metadata is rejected with `EB-3007`.

## [0.7.3] — 2026-09-30

### Added

- **Offline manual content authoring:** Study Guides, Flashcards and Practice Quizzes can now be created and edited entirely by hand with no AI key or internet connection. AI remains available as an optional drafting shortcut, and teacher-authored material is approved as it is saved.
- **Offline worksheet export:** a Resource's approved study material can be exported as an editable Word/WPS worksheet with student questions followed by an answer key.
- **Offline practice-deck export:** approved flashcards and quiz questions can be exported as a projector-ready PowerPoint deck with prompt and answer slides.
- **WeChat and QQ communication destinations:** Settings can now keep class-specific WeChat/QQ join links or QR images alongside DingTalk and WeCom groups. Invite links can be converted to QR codes locally, and QR images can be imported directly.
- **Capability-aware message routing:** DingTalk/WeCom continue to send automatically through robot webhooks; WeChat/QQ destinations copy the prepared EduBoard message for manual paste instead of pretending a consumer-group webhook exists.
- **Per-destination routing mute:** each communication destination can mute or unmute EduBoard-originated routing without changing the external app's own notification settings.

### Changed

- Resource Study Guide / Flashcards / Practice Quiz tools are available on every Resource, including blank/manual resources; readable source text is only required when choosing AI generation.
- Class Story now routes through the saved destination's real capability and labels automatic, copy/paste and muted routes explicitly.

## [0.7.2] — 2026-09-30

### Added

- **Offline Study Packs:** export any Resource as a standalone HTML file containing teacher-approved study guides, flashcards and practice quizzes. The file needs no EduBoard installation, account, server or internet connection, and stores the student's own progress locally on their device.
- **Offline Lesson Packs:** export a lesson as a portable ZIP containing an offline lesson index, student-shared resource study pages and copies of available linked local files. Resources not marked for student sharing are excluded.
- **Offline Classroom Hub practice:** teacher-approved flashcards and practice quizzes attached to a lesson can now run directly in Classroom Hub, including projector-only mode, with no Portal or AI call during class.
- **Quick Board:** a large, full-screen classroom prompt/model-answer board with hide/reveal and adjustable display size.
- **Team Scoreboard:** a full-screen four-team classroom scoreboard for games and participation activities.

### Changed

- EduBoard's classroom workflow now treats internet access as optional: PPTX/teacher tools remain local, Classroom Hub can run on loopback or a local network, and student self-study material can be exported for later offline use.

## [0.7.1] — 2026-09-30

### Added

- **Projector-only Classroom Hub:** teachers can project a lesson directly from EduBoard in a dedicated maximized window with no Wi-Fi or internet connection. The projector uses loopback networking on the teacher's own computer, keeps Talk Ladder and Listening Lab available, supports F11 full screen, and leaves QR/student-device sharing as an optional local-network mode.

## [0.7.0] — 2026-09-30

### Added

- **Classroom Hub:** a local-WiFi student page launched from a class, with the current lesson, objectives, activities, shared resources, Listening Lab audio and Talk Ladder prompts. It uses the existing classroom server, so students scan one QR code and need neither an account nor internet access.
- **Assessment retries:** assessments can keep retry attempts and count the best attempt in the gradebook; the retry popover shows the attempt history without replacing the original score.
- **Evidence Grid:** a fast per-lesson class grid for completion, speaking-ladder levels 1–5, missing and not-observed evidence.
- **Student course overview:** the Portal Home page now shows course/unit context and upcoming learning alongside the existing week plan.
- **Listening Lab:** shared audio resources can play through the Classroom Hub as focused listening practice rather than only as ordinary files.
- **Talk Ladder:** speaking prompts and support frames can be shown directly in the Classroom Hub for staged pair/group practice.
- **Student learning progress:** competency/standard evidence published from the desktop is shown back to students as learning progress on the Portal.
- **Rich Portfolio:** teacher-selected work on the Portal can include the actual submitted file, not only its title, grade and feedback.
- **Original shared resources:** a Portal material now includes the teacher's original HTTPS link, note or file as well as any approved study guide, flashcards or practice quiz. Files are fingerprinted, uploaded separately and only downloadable by accounts linked to an actively enrolled student in that class.
- **Private Course Bundles:** `.coursebundle` files package a Course Pack with its local resource files for private portable import. The builder, preview/import flow and documentation are included; private bundles remain git-ignored and blocked by the private-content guard.

### Security

- **Private-content guard:** Git now ignores Portal `.env` files, deployment certificates, private curriculum scratch work and generated course deliveries. CI refuses to accept tracked environment files, Course Packs, Course Bundles or the private resource-pack paths. `portal/.env.example` documents the required Portal variables without real secrets.

## [0.6.1] — 2026-09-28

**If you run a Portal, update it** (Harden-Server.cmd updates it and locks down the server in one go): the terms and consent screen, each assessment on the Grades page, the calendar link and the brochure need the updated Portal.

### Changed

- **EduBoard is now licensed under the GNU Affero General Public License v3.0** (`AGPL-3.0-only`), the app and the Portal both. You may still use, change and share it; anyone who shares a changed version, or runs a changed Portal for others, must offer their changed source. Versions up to 0.6.0 stay available under MIT. The Portal's login and Account pages and the app's About panel link to the source.

### Added

- **The school's own name for the app** (Settings → Appearance → App name), e.g. "Riverside Teacher Hub", shown in the sidebar, the window title and the lock screen; the school logo is now also the window's icon in the taskbar. School packs carry the name too.
- **A school pack for everyone on a computer**: a school's IT puts `school-pack.json` in `C:\ProgramData\EduBoard` (or runs Install-School-Pack.cmd as administrator), and every teacher on that computer gets the school's name, logo, colour and stylesheet, locked, plus the rest of the pack once per version. See `docs/SCHOOL_DEPLOYMENT.md`.
- **A public demo login on the Portal** (`PORTAL_DEMO=1`; `Set-Up-Homepage.cmd` turns it on): username `demo`, password `try-eduboard`, for anyone to see what families see. It's a made-up class under its own demo teacher, with a report card, a notice to answer and a message. Its password, email and QR logins can't be changed (PT-1009), it resets every day, and it's left out of the admin page's usage numbers. The homepage's new **Try it first** section shows the login and points to the app's sample school.
- **Sample school** (Settings → Help and updates, or the getting-started checklist): EduBoard reopens on two classes of made-up students with a term of scores, attendance, class points, homework, lesson plans, notes and report comments, to try it or show it to a school. It lives in its own folder; the teacher's own classes are never read or changed, and a banner offers **Back to my classes** and **Start over**. No backups or usage pings are made from it.
- **Portal usage on the admin page** (portal address /admin.html): teachers publishing, students with a login, families and teachers active each week (last 12 weeks), share of report cards opened, notices answered, Class Story posts seen and work handed in. **Copy as text** puts it all in an email or a pitch. It's worked out only from what the Portal already keeps for its features; nothing new is recorded.
- **Terms of use** at edu-board.com/terms (English and Chinese), linked from the homepage, the privacy pages and the Portal's login and Account pages.
- **A record of agreeing to the terms on the Portal.** The first time a family signs in, a parent or guardian agrees by name (or a student aged 14 or over agrees themselves) before seeing anything; the Portal records who, when and which version (PT-1010 if the name is missing). The admin page shows how many logins have agreed and downloads the records as **Consent records (CSV)** for the school's files. A school that collects consent on paper can turn the question off with `PORTAL_CONSENT=off`.
- **Download my data** (Portal → Account → Your data): a family gets a copy of everything the Portal holds about them and their children as one file: profile, classes and grades, handed-in work, answers, report cards, notice replies, messages and Study Helper questions.
- **Each assessment on the Portal's Grades page**: families see every marked assessment with the score (late and excused marks, and the level reached on each rubric criterion), the three most recent first, and a chart of how scores have gone. Settings → Portal and families → **Scores families see** decides how much: scores are on; the teacher's comments and the class average are off until turned on (comments in the gradebook are often notes to self), and the average only shows once 5 or more students have a score. Assessments nobody has been marked on never show. They're in **Download my data** too, and the Portal demo shows them. Needs the updated Portal.
- **Homework in the family's own calendar** (Portal → Account → Calendar): a private link that Google Calendar, iPhone, Outlook and most phone calendars subscribe to. Every due date is there as an all-day event, ticked (✓) once the work is handed in, and the calendar refreshes by itself. The Portal keeps only a fingerprint of the link; **Make a new link** stops the old one working, and **Turn off** removes it. Needs the updated Portal.
- **Harden-Server.cmd** locks down the Portal server in one go: a firewall (only the website and SSH), blocking of addresses that keep failing to sign in, automatic security updates (restarting at 04:00 China time when one needs it), and the Portal running as its own restricted user instead of root. It also gives the computer a key to sign in with and, once that's proven to work, offers to turn off password sign-in. The steps are in `portal/scripts/harden-server.sh`.
- **Automatic dependency checks**: every push and every Monday, GitHub checks the packages the app and the Portal ship with for known security problems, and Dependabot proposes updates once a month.
- **A two-page overview for schools** at edu-board.com/brochure (English and Chinese, prints to A4 or PDF), with pictures of the sample school and the Portal demo, linked from the homepage's "For schools" section. `docs/DEMO_VIDEO_SCRIPT.md` is a 2½-minute demo video script in both languages.
- **Security overview** at edu-board.com/security (English and Chinese, printable): how the app and the Portal protect student data, how portal.edu-board.com is run, and what isn't done yet, for a school's IT or data protection review. Linked from the homepage ("For your IT and data protection review"), the privacy pages and Settings → Help and updates. The Portal also answers `/.well-known/security.txt`.

### Security

- **Electron 44** (from 39, which no longer gets security fixes): the app runs on a supported, patched Chromium again.
- **Portal:** nodemailer 10 (fixes for email header and SMTP command injection in the weekly digest's mail sending) and sharp 0.35.5 (image library fixes for profile photos). The Portal now needs Node.js 20.9 or newer; the updater says so before changing anything.
- **App:** drizzle-orm 0.45.3 (SQL identifier escaping), and newer uuid and image-size inside the spreadsheet and slide exporters.

### Fixed

- **The Portal's sign-in cookie is marked Secure, and browsers are told to stay on HTTPS (HSTS), whenever the Portal is reached over HTTPS.** Both used to depend on `NODE_ENV=production`, which the live Portal didn't have set.
- **The privacy notice named the wrong cipher** for the app's password protection: it's ChaCha20-Poly1305 (SQLite3 Multiple Ciphers), not AES-256. `SECURITY.md` is up to date again (it still said there was no update mechanism and no server).
- "Students to check on" said "Below the pass mark (60% vs 60%)" for a student on 59.6%; it now shows the decimal when rounding would hide the gap.

## [0.6.0] — 2026-09-28

**If you run a Portal, update it** (Update-Live-Portal): sending report cards, reply slips on notices and the privacy pages need the updated Portal. Score import and the student timeline work without it.

### Added

- **A timeline on every student's page**: everything recorded about the student, newest first, across all their classes, grouped by month. Absences and lateness (with the note), scores (points, maximum and percent), class points (a line a day, by category), log notes and parent contacts (and follow-ups still needed), homework handed in with its grade, report card comments, joining a class, and Portal messages with the family when the Portal is connected. Chips show or hide each kind; with several classes, a menu shows one class.
- **Import scores from a spreadsheet** (Gradebook → Import scores): scores from an exam system's or a colleague's .xlsx or .csv. EduBoard finds the student column (student number, name in any usual order including Chinese names, or first and last name) and the score columns, and matches each to an assessment of the same name or a new one (a heading like "Unit test (/50)" gives the maximum). Before anything is saved, it shows how many rows matched, which rows didn't, which cells it leaves out and why (not a score, over the maximum), and every score it would replace, old → new. "EX" or 免考 marks a student excused; "85%" becomes points. Each imported score keeps its history like one typed in.
- **Notices with a reply slip (回执).** A Class Story post can ask families to confirm "I've read this" or answer a yes / no question ("May your child come on the trip?"). Families answer on the Portal for each of their children and can change their answer; the teacher sees "Yes 12 · No 3 · Not replied 9" (or "Confirmed by 18 of 24 families"), who hasn't replied and who said no, and **Remind** sends everyone who hasn't replied a Portal message. Needs the updated Portal.
- **Report cards sent privately to families** (class → Report → Send report cards to families). Each student's report card, the same PDF as Print PDF, goes to their own family on the Portal under a title such as "End of Term 1 report". Families see a "New report card" notice on the Portal's Home and find it under Grades; the teacher sees "Opened by 12 of 20 families", who hasn't opened it and who has no Portal login yet. Sending the same title again replaces the cards (for a correction); **Withdraw** takes them down. Needs the updated Portal.
- **Privacy notice and data processing terms**, in English and Chinese, at edu-board.com/privacy and edu-board.com/data-processing (on every Portal too). The notice says plainly what the app and the Portal keep, where, who can see it and for how long; the terms are what a school signs before using portal.edu-board.com (roles, safeguards, sub-processors, 48-hour breach notice, Hong Kong hosting and China's cross-border rules, deletion at the end). Linked from the homepage, the Portal login and Settings → Help and updates.
- **edu-board.com as the homepage.** `Set-Up-Homepage.cmd` (double-click, once) updates the Portal and makes edu-board.com and www.edu-board.com show EduBoard's homepage with downloads, while the Portal stays at portal.edu-board.com. The homepage's "Log in" links go to the Portal's address (new `PORTAL_HOST` setting), and the Portal's login and admin pages ask search engines to leave them out of results.

## [0.5.1] — 2026-09-27

**If you run a Portal, update it** (Update-Live-Portal): the homepage at `/download` and the Portal's PT error codes need the updated Portal.

### Added

- **Error codes.** Every error message now ends with a code: EB-xxxx from EduBoard on the teacher's computer, PT-xxxx from the Portal (shown on the Portal's pages too). [docs/ERROR_CODES.md](docs/ERROR_CODES.md) says what each one means and how to fix it. **Settings → Help** lists recent errors and copies an error report (version, system, recent errors) to send; unexpected errors show a short reference that points to the full details in the error log (`logs/errors.log` beside the database) or, for the Portal, in the server log. A screen that fails to draw now shows a Reload button and its code instead of a blank window.
- **A homepage with downloads** at `/download` on the Portal (portal.edu-board.com/download), in English and Chinese: what EduBoard does, screenshots, and every download for Windows, Mac and Linux through the Portal server (so they work where GitHub is blocked), with GitHub as a second link. The Portal's login page links to it for teachers. A Portal can also make it the front page of another address (`HOMEPAGE_HOSTS`).

### Changed

- **Settings is split into sections** with a menu on the left: You and your school, Appearance, Grading and reports, Class lists, Portal and families, AI, Data and security, and Help and updates. **Search settings** finds a section by what you type. Each box has its own **Save** and **Undo changes**, and says "Not saved yet." when something in it has changed, instead of one Save for a long page. Links from the Dashboard and the getting-started checklist open the right section.

### Fixed

- **School stylesheet** said nothing after loading, so a stylesheet made for a website (such as a WordPress theme) seemed to be ignored. EduBoard now says what a loaded stylesheet changes, or that it looks made for another website and changes nothing, and **Save an example to start from** saves a stylesheet with every EduBoard colour in it to edit.
- **Report comment bank → Add a ready-made set** seemed to do nothing: the sentences were added out of sight at the end of the list, and the menu went back to its first line. It now scrolls to them, says how many were added (or that they're all there already), and reminds you to Save.

## [0.5.0] — 2026-09-27

**If you run a Portal, update it** (Update-Live-Portal): read receipts, class points in the digest and the usage count need the updated Portal.

### Added

- **What class points are for** (Settings → Your lists): rename EduBoard's five categories, add your own, or use a ready-made set (德智体美劳, or Respect / Effort / Teamwork…). The Classroom tab and seating chart give points by category; report cards (printed and Word) show each student's points per category (a switch in Settings → Report cards); the family digest can show the past week's (off unless you turn it on). School packs carry the categories. Points given before this keep their category.
- **Seating chart: Give points.** Tap a seat for +1, or its − for −1, with this week's points on each seat. Student fields marked *Show on the seating chart* (allergies, support plan…) put a small icon on the seat when something is recorded; hidden while presenting.
- **Class Story read receipts**: "Seen by 24 of 30 families" under each post, with who hasn't seen it yet and how many students have no Portal login.
- **DingTalk (钉钉) and WeCom (企业微信) group chats** (Settings → Class group chats): paste a group robot's webhook address (with DingTalk signing if used), send a test message, then send each Class Story post and newsletters to the group. Needs internet; only those two services' addresses are accepted.
- **Help improve EduBoard** (Settings): an anonymous "still using it" ping, at most once a week, off unless the teacher turns it on. It sends only a random id, the version, system, language and rough class and student counts, and Settings shows exactly what it sends. The Portal's admin page shows weekly active copies and how many are still in use 4 and 12 weeks later.

## [0.4.0] — 2026-09-27

**If you run a Portal, update it too** (Update-Live-Portal) after installing 0.4.0: the digest preview and settings, newsletters in the digest, emailing your week to yourself, and removing deleted students from the Portal all need the updated Portal. Everything else works with the Portal you have.

### Added

- **Word and PowerPoint files** for finishing work in Office or WPS: every report card (Report tab), every parent letter (Parent letters), a newsletter, and a lesson plan as a Word document; a lesson plan as a starter slide deck (title slide in the school colour, objectives, materials, one slide per activity, homework). Made on your computer; nothing is uploaded.
- **Weekly digest you can see and shape.** Settings → Portal sync → **Preview** shows exactly what each family would get this week (and which families have no email yet). Choose what families get (grades, attendance, homework due, Class Story, unread-message reminder); the digest is written in the language EduBoard is in. Needs the Portal updated.
- **Your week** (Dashboard): the teacher's own weekly summary across every class: what was taught and is coming up, homework due and not handed in, students to check on and parent follow-ups owed. Print it, or **Email it to me** (to your own address in Settings, through the Portal's digest email).
- **Newsletter** (sidebar): pick the classes and who it's for (friendly for families, a pyramid for school leaders, simple for young readers, or your own headings), tick this week's lessons, homework and Class Story posts and add notes. **Arrange for me** sets them out word for word with no internet; **Suggest wording with AI** (needs internet) may only word and order those facts, leaving [gaps] instead of inventing anything. Then add it to this week's family digest, post it to Class Story, or copy it. Nothing about any single student goes in.
- **Templates** in English and Chinese. Parent letters: progress update, attendance concern, missing homework, good news, meeting invitation. Class Story: this week we learned, reminder, celebration, upcoming event, homework heads-up. Lesson plans: 5E, I do / We do / You do, PPP, SUCCESS (oral English) and Workshop. **Save as template** keeps your own letters, posts and lesson plans (listed in Settings → Your lists). The comment bank can add ready-made sets (primary, secondary, English as an additional language).
- **Report card layouts** (Settings → Report cards): standard, compact or detailed, with switches for each section, signature lines, your own title and a line at the bottom. School packs carry the layout and your saved templates.
- **Your own attendance codes** (Settings → Your lists): rename Present, Late, Absent and Excused, or add codes like Sick, Field trip or School event, each counting as one of the four so rates stay right. Right-click a cell in the attendance grid to pick any code and add a note (a dot shows there's one). Codes you stop using are hidden, not deleted. School packs carry them.
- **Your school's words** (Settings → Your lists): say "section" instead of "class", "test" instead of "assessment", "learner" instead of "student", and so on, in English and in Chinese separately; EduBoard uses them on every screen and printout. School packs carry them.
- **EduBoard in Chinese (中文).** Every screen, message, printout (report cards, parent letters) and the exit-ticket and check-in pages students open on their phones can be in Simplified Chinese. Switch with **中文 / EN** at the bottom of the sidebar or in Settings → Language; it follows the computer's language until you choose. Dates, the timetable clock and name order follow the language (a name written in Chinese shows family name first, 陈麦). The built-in comment bank, log buttons and parent letter have Chinese versions, used whenever you haven't changed them, and AI suggestions and lesson-plan drafts come back in the app's language. Roster imports accept Chinese headings (学号, 家长电话…) and a single 姓名 column.
- **Start next term for every class at once** (Classes → Start next term): pick the ending and next term, untick any class that doesn't carry on, and each gets a next-term class with the same setup and, if you like, the same students and timetable; the old classes can be archived in the same step. Running it twice makes no doubles.
- **Today** on the Dashboard: today's lessons from the timetable, each showing whether attendance is taken and which lesson plan it has, plus parent follow-ups due.
- **Students to check on** (Dashboard): students below their class's pass mark, dropping 8 or more points over their last few scores, or with three or more concerns logged in 30 days, each with the reason.
- **Copy last week** (Lesson plans): copies last week's plans to the same days this week as Planned, skipping any already there.
- **Parent letters** (a class's Report tab): one letter per student as a single PDF, from a template you edit, with the parent's name, grade, percent and attendance filled in. The template travels in school packs.
- **Export everything (Excel)** (Settings → Backups): all your data in one workbook, a sheet per table, for a school's records or moving to another system.
- **Grading scales.** Besides A–F: A–F with + and −, 优秀/良好/合格/待合格, 优秀/良好/中等/及格/不及格, 1–7, 9–1, Pass/Fail, or your own bands, per class (class Settings) and as the default for new classes (Settings). Badges, reports, composite grades and the Portal use the class's own labels.
- **Report card comments** (a class's Report tab): write each student's comment, add sentences from a comment bank with {name}, {class}, {grade} and {percent} filled in (edit the bank in Settings → Your lists; it travels in school packs), and **Print all report cards** as one PDF, a page each. Comments print on the report card.
- **Classroom tab** on every class, made for the projector (it stays visible while presenting): a random name picker that gets through everyone before repeating, a group maker (groups of N or N groups), a full-screen timer with a chime, and class points (+1 / −1 with an optional reason, weekly totals, undo). Students marked absent today are left out of the picker and groups.
- **School pack** (Settings): export the school's name, logo, colour, grading scale, pass mark, terms, log buttons, student fields and stylesheet as one file; colleagues import it (after seeing exactly what it changes) to match. No student data is in it.
- **School stylesheet** (Settings → Appearance): load a .css file for the school's own background or fonts. It can change EduBoard's colour tokens and use inline images, but nothing in it can load from the internet.
- **Your lists** (Settings): edit the one-tap buttons above a student's log, and add your own student fields (house, allergies, support plan…), which appear on the student form and page and are filled by a roster import from columns with the same name. They're never sent to the Portal.
- **Appearance** (Settings): the school's logo (in the sidebar and on report cards) and colour, text size, higher contrast and reduced motion. The school's name also shows under EduBoard in the sidebar.

- **Exit tickets: names from the class list.** Students pick their name instead of typing it, a second answer replaces their first, and the session shows who hasn't answered yet. A session can close itself after 5, 10, 15 or 30 minutes.
- **Automatic updates.** A new version downloads in the background while you work and installs the next time you open EduBoard, after the usual launch backup; a small window says so and EduBoard reopens by itself. While it waits, a banner says it's ready, and an update icon at the top of the sidebar and a dot on Settings stay until it's installed. **Restart and update now** in Settings installs it straight away. Turn it off in Settings → *Install updates automatically* to update only by hand. If an automatic install ever doesn't finish, EduBoard doesn't retry on every launch; it waits for you to install from Settings.

### Fixed

- **Deleting a student now removes them from the Portal too.** Before, a publish only took their name off the roster: their login still worked, their handed-in work, profile and Study Helper history stayed on the server, and a student who had joined through a class link came back on the next publish. Deleting or erasing a student now removes all of that from the Portal at once, or, if the Portal can't be reached, the next time you publish. The Portal needs updating (Update-Live-Portal) for this.

### Changed

- **AI and report comments:** instead of drafting whole comments, AI now suggests a few short phrases (needs internet), each labelled with what it's based on (grade, trend, attendance or notes), for the teacher to add and edit. Replies that aren't short, grounded phrases are refused rather than shown.

### Security

- **Presenting mode** (projector icon in the sidebar): hides pages with grades, notes, contact details and keys, and blurs attendance rates, while the seating chart, exit ticket, QR check-in and lesson plans stay usable on the projector.
- **A student's data**: download everything held about a student, or erase all of it for good (every record, their audit history, and the free space in the database file) from their page.
- **Password protection** (Settings → Password protection). Encrypts EduBoard's database and backups, asks for the password when EduBoard opens, and locks after a chosen idle time or when the computer locks or sleeps (exit tickets and backups keep running while it's locked). A recovery key, shown once, opens it if the password is forgotten. Backups made before it was turned on can be deleted from the same panel.
- **QR attendance:** each phone can check in one student per session, so a student can't mark absent friends present. Exit tickets and check-in limit how often one device can send, generously enough for a whole class behind one network address.

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
