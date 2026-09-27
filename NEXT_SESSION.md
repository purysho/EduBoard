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

1. ~~Desktop app in Chinese or English~~ **done.** How it works, for new screens:
   - Wrap every piece of interface text: `tr('English text', { vars })`, `trn(one,
     other, n)` for counts, `trNodes('Text with {link}', { link: <a/> })` when a
     sentence contains an element (all from `@shared/i18n`; trNodes from
     `@renderer/lib/trNodes`). The English is the key.
   - Add the Chinese to `src/shared/i18n/zh/<area>.ts`. `npm test` fails
     (coverage.test.ts) if any `tr` string has no translation or a translation
     drops a `{placeholder}`. Text reaching tr() through a variable goes in
     `dynamicKeys.ts`.
   - `node tools/i18n/untranslated.cjs "$PWD"` lists English not yet wrapped.
   - Language is set before any screen code runs (preload → i18nInit.ts) and a
     switch reloads the window, so module-level `tr()` is fine. The main process
     uses the same `tr` (set in `src/main/i18n.ts`).
2. ~~Own attendance codes and renamed terms~~ **done**: `src/shared/attendanceCodes.ts`
   (codes count as one of the four built-ins; records store the code id) and
   `setTerminology()` in `src/shared/i18n` (applied inside tr(); the words live in
   settings and in ui-prefs.json beside the database for startup).
3. ~~Portal: delete one student~~ **done** (`POST /api/sync/delete-student`).
4. ~~Start next term for every class at once~~ **done** (Classes page).
5. ~~Templates for each section~~ **done** (`src/shared/templates.ts`,
   `components/TemplatePicker.tsx`, Settings → Report cards). Newsletters get theirs
   with item 6.
6. ~~Weekly Digest preview, teacher/family versions, AI newsletter~~ **done**
   (portal/services/digest.js, src/main/services/weeklySummary.ts,
   newsletterService.ts, shared/newsletter.ts, pages/Newsletter). The user's rule
   still applies: AI suggests, never writes the whole thing unchecked; "needs
   internet" next to AI.
7. **Competitor website**: https://www.educationtek.com/en-US/en-solution/smart-school-system.html
   (HappyClass Smart School System: homework guide videos, flipped classroom,
   IoT smart classroom, vocabulary system, SPOC live/on-demand courses). Fold
   into the competitor research doc.
8. ~~Connect to other apps~~ **Word/PowerPoint done** (`src/main/services/officeExport.ts`,
   `docx` + `pptxgenjs`; IPC `office:word` / `office:slides`). Excel already existed
   (gradebook, course grade sheet, export everything, roster import). WeChat, Alipay,
   Google, Apple ID and SSO logins: planned in `docs/ROADMAP_VC.md` with what each
   needs; none built yet.
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
