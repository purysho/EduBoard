# Next session: start here

Written 2026-09-27 at the end of a long build session, for a fresh Claude session
picking EduBoard up cold. Read this first, then `handoff.MD` (older, Windows testing
notes), `ROADMAP.md` and `CHANGELOG.md` (the `[Unreleased]` section lists everything
built since 0.3.3).

## State

- Repo `purysho/EduBoard`, branch **`main`**. Commit and push straight to `main`
  (the user asked for this). No PRs unless asked.
- Last commit: `e291e27`; Tests and Windows test build both green.
- `package.json` still says **0.3.3**. Everything in `[Unreleased]` (auto-update,
  password protection, presenting mode, exit tickets by roster, school pack, grading
  scales, Classroom tab, report comments, Today card, parent letters, export
  everything…) is **not released**. Ask the user before cutting 0.4.0.
- Commits end with the Co-Authored-By / Claude-Session lines the harness gives you.
  No model names in commits.

## How the app is built (so you don't re-derive it)

- Electron 39 + electron-vite + React 19 + Tailwind v4 (colours are CSS variables in
  `src/renderer/src/styles.css`) + drizzle-orm + better-sqlite3 (aliased to
  `better-sqlite3-multiple-ciphers` for encryption).
- Migrations: `src/main/db/migrations.ts` (latest id 32). Add a new numbered one.
- A new IPC call goes in four places: `src/shared/ipc.ts`, `src/shared/api.ts`,
  `src/preload/index.ts`, and a `handle()` in `src/main/ipc/register.ts` (which
  refuses non-`security:` channels while the app is locked).
- Settings: `AppSettings` in `src/shared/types.ts`, defaults in `DEFAULT_APP_SETTINGS`;
  things a school shares go into `src/shared/schoolPack.ts` (parse/make/plan + test).
- PDFs: `printRouteToPdf(route, fileName)` in `register.ts` renders a route under
  `/print/...`; the page sets `document.title = 'eduboard-print-ready'` when done.
- The Portal (student/parent website) is `portal/` (Node/Express, `db.js`,
  `routes/`, `services/digest.js` = weekly digest, `public/i18n.js` = its
  English/Chinese switch).
- Checks before every push: `npm test`, `npm run typecheck`, `npm run lint`,
  `npx prettier --check "src/**/*.{ts,tsx}"`.
- Seeing it in the real app: `tools/ui-check/app.mjs` (launch/go/seed with
  Playwright `_electron`). Run `npx electron-vite build` first, start Xvfb
  (`Xvfb :99 -screen 0 1600x1000x24 &`), run scripts with
  `NODE_PATH=$(npm root -g)`. Stub dialogs with `app.evaluate(({dialog}) => …)`.
  React Query caches for 10 s, so reload or set `staleTime: 0` when checking.

## The user's next requests (in their order)

1. **Desktop app fully in Chinese or English**, with a switch like the Portal's
   (`portal/public/i18n.js` is the model). The desktop UI is English-only
   strings in JSX today: add a small `t()` layer with `en`/`zh-CN` dictionaries,
   a Settings language choice (also usable on first launch), and translate every
   page, print pages (report cards, letters) included. Dates and numbers per locale.
2. **Own attendance codes** (and a comment on a code if needed), and **renaming
   terms** such as "class" and "assessment". Attendance statuses are currently
   fixed (present/absent/late/excused); make a list in settings (code, label,
   colour, counts-as present/absent) and keep reports/attendance % right. Terminology
   renames should go through the same `t()` layer as item 1. Both go in school packs.
3. **Portal: delete one student.** Works in the desktop app, not on the Portal.
   The Portal only deletes in bulk (`portal/routes/admin.js` ~line 110). Add a
   single-student delete (grades, enrollments, profiles, account links, then the
   account if unlinked), and have the desktop's erase/delete send it on next sync
   (`src/main/services/portalSyncService.ts`). Test it.
4. **"Start next term for every class at once"** button. Per-class version exists
   (class Settings → Start next term); build a Settings/Classes screen that lists
   this term's classes with checkboxes and runs the same service for each.
5. **Templates for each section**: report cards, comment bank sets, parent
   letters, class story, lesson plans, newsletters. A template picker with
   several built-in styles plus the user's own saved ones; school packs carry them.
6. **Weekly Digest**: a preview of what's in it before it goes; a **teacher
   version** and a **family version** (student details vs parent details:
   decide which fields each audience sees); **AI-assisted newsletter**: choose
   a structure (Minto pyramid for school leaders, a friendly one for families,
   simple language for younger readers, custom), with include/exclude fields.
   AI suggests and formats; the teacher approves. Say "needs internet"
   next to AI features (the user's standing rule: AI suggests, never writes the
   whole thing unchecked, to avoid made-up content).
7. **Competitor website**: the user said "see this website for features we can
   implement and look toward VC funding" but **no link came through**. Ask for
   the URL first.
8. **Connect to other apps**:
   - Now: Word (.docx), PowerPoint (.pptx) and Excel (.xlsx) export/import for
     reports, letters, lesson plans, gradebook (Excel export already exists).
   - Plan, and prototype if feasible: WeChat and Alipay login / phone-number
     binding for China on the Portal; Google, Apple ID and school SSO
     (OIDC/SAML). Anything that needs company registration, app-store
     accounts or paid developer programs: write it into a **VC roadmap** section
     instead, with what each needs (accounts, costs, ICP licence for China, etc.).
9. **Competitor list**: research ClassDojo, Seesaw, Google Classroom, PowerSchool,
   Toddle, ManageBac, Veracross, Class Charts, Bloomz, Remind, ParentSquare,
   SchoolCues, 钉钉/DingTalk, 企业微信/WeCom, 班级优化大师, 晓黑板 and similar.
   List features we could adapt to EduBoard (offline-first, teacher-owned
   data, China-friendly), with effort and value, and put it in a doc for the
   VC pitch.

## Still unverified from last session

- AI phrase suggestions were never run against a real AI key.
- The install-on-next-launch update was tested end to end on Linux only; Windows
  and macOS have CI builds but no real install test.
