# Next session: start here

Written 2026-09-27 at the end of a long build session, for a fresh Claude session
picking EduBoard up cold. Read this first, then `handoff.MD` (older, Windows testing
notes), `ROADMAP.md` and `CHANGELOG.md` (the `[Unreleased]` section lists everything
built since the last release).

## State

- Repo `purysho/EduBoard`, branch **`main`**. Commit and push straight to `main`
  (the user asked for this). No PRs unless asked.
- **0.5.0 released 2026-09-27** (tag `v0.5.0`; 0.4.0 the same day). The Release
  workflow builds Windows, Mac and Linux and publishes to GitHub Releases, which is
  where the in-app updater looks (through the teacher's Portal when one is set up, so
  it works from mainland China). Anything new goes under `## [Unreleased]` in `CHANGELOG.md`. To release
  again: `npm version X.Y.Z --no-git-tag-version` (also updates
  `portal/desktop-version.json`), move the changelog section, commit, push `main`,
  then start Actions → Release → Run workflow on `main` (this environment can't push
  tags; the workflow makes the tag from package.json).
- Commits end with the Co-Authored-By / Claude-Session lines the harness gives you.
  No model names in commits.

## How the app is built (so you don't re-derive it)

- Electron 44 + electron-vite + React 19 + Tailwind v4 (colours are CSS variables in
  `src/renderer/src/styles.css`) + drizzle-orm + better-sqlite3 (aliased to
  `better-sqlite3-multiple-ciphers` for encryption).
- Migrations: `src/main/db/migrations.ts` (latest id 33). Add a new numbered one.
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
- Errors: throw `new AppError('EB-xxxx', tr('…'))` (codes in `src/shared/errorCodes.ts`,
  with what they mean and how to fix them). The IPC `handle()` wrapper adds the code to
  the message ("… [EB-1003]"), logs it (`src/main/services/errorLog.ts`, beside the
  database in `logs/errors.log`), and turns anything uncoded into EB-0900 with a
  reference. Portal errors answer `{ error, code: 'PT-xxxx' }` (`portal/errorCodes.js`).
  After adding a code run `npm run error-codes` to regenerate `docs/ERROR_CODES.md`;
  tests fail if a code is missing from a catalog, unused, or the doc is stale.
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
7. ~~Competitor website~~ and 9. ~~Competitor list~~ **done**: `docs/ROADMAP_VC.md`
   (HappyClass, 20-odd competitors, logins plan, VC case). Its "top ten" list is the
   feature backlog.
8. ~~Connect to other apps~~ **Word/PowerPoint done** (`src/main/services/officeExport.ts`,
   `docx` + `pptxgenjs`; IPC `office:word` / `office:slides`). Excel already existed
   (gradebook, course grade sheet, export everything, roster import). WeChat, Alipay,
   Google, Apple ID and SSO logins: planned in `docs/ROADMAP_VC.md` with what each
   needs; none built yet.
10. ~~Top four from the roadmap, plus the usage ping~~ **done** (after 0.4.0, unreleased):
    - Point categories: `src/shared/pointCategories.ts` (built-in five and ready-made
      sets are saved with a blank name = usual name in the UI language),
      `behaviour_points.category` (migration 33), `pointSummaries()`, report card
      `showPoints`, digest part `points` (off unless chosen; Portal `grades.points`).
    - Seating chart "Give points" mode and `StudentField.onSeatingChart` icons.
    - Read receipts: Portal `post_reads`, marked when a family's `/api/me/posts` feed
      loads; `/api/sync/posts` returns `seenCount/audience/notSeen/noLogin`.
    - Group chats: `src/shared/groupChats.ts` + `src/main/services/groupChat.ts`. Only
      `oapi.dingtalk.com/robot/send` and `qyapi.weixin.qq.com/cgi-bin/webhook/send`
      are accepted. Real replies checked: DingTalk unknown robot = 300005, WeCom = 93000.
    - Usage ping: `src/shared/usagePing.ts`, `src/main/services/usagePing.ts`, sent to
      `https://portal.edu-board.com/api/usage/ping` (Portal `routes/usage.js`); admin
      page shows weekly active copies and 4/12-week retention. **The live Portal needs
      updating (Update-Live-Portal) before pings are counted.**
    Next: the P0 / P1 / P2 list in `docs/ROADMAP_VC.md` section 3 ("What to build
    next"). P0 is private report delivery, notices with acknowledgement (回执),
    targeted messages with attachments, conference booking and forms; P1 is score
    import, student timeline, a named local-AI option and Bridge basics. Keep to the
    user's rule: AI suggests, the teacher writes.

## Still unverified from last session

- AI phrase suggestions were never run against a real AI key.
- The install-on-next-launch update was tested end to end on Linux only; Windows
  and macOS have CI builds but no real install test.
