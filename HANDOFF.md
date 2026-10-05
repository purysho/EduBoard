# EduBoard Handoff

## Current state

EduBoard **v0.7.8 — Lean Core** remains the latest published measured release baseline.

The v0.7.8 release is complete, documented and closed. Its measured reductions versus v0.7.7 were:

- Windows Setup: **-9.38%**
- Windows Portable: **-9.40%**
- Linux AppImage: **-5.84%**
- macOS arm64 DMG: **-10.72%**
- macOS x64 DMG: **-10.39%**

The repository has since moved forward on `main` with a post-v0.7.8 workflow/evidence loop. These changes are merged but should not be confused with the already-published v0.7.8 release.

## Post-v0.7.8 work completed

### PR #52 — Offline Study Pack progress returns

- standalone Study Packs can export a tiny JSON progress return;
- teachers import it from the matching Resource;
- no account, server or internet connection is required;
- malformed/cross-resource files are rejected;
- exact unique roster names can be linked automatically;
- summary flashcard/quiz progress is stored and shown in EduBoard.

### PR #53 — School Pack audit preview

- preview shows what school-wide configuration the pack contains;
- preview explicitly lists classroom/operational data the pack never contains;
- preview separately lists the exact changes the import will make;
- School Packs still do not carry classes, students, grades, homework, messages or credentials.

### PR #54 — Bulk teacher workflows

- teachers can select and archive multiple classes;
- one homework assignment can be copied to multiple active classes;
- copied homework keeps reusable content, attachment, rubric and quick-check questions;
- copied assignments are drafts with no due date.

### PR #55 — Package-composition evidence

- package reports now identify Electron/runtime support, locales, `app.asar`, native binaries and packaged Node modules;
- `app.asar.unpacked/node_modules` is itemized by package;
- Windows test builds and release builds report unpacked package composition when available.

The dependency-removal experiment inside this loop also produced a useful negative result:

- `@electron-toolkit/utils` is required by `src/main/index.ts`;
- `date-fns` is required by `CalendarPage.tsx`.

Both were restored and the final deterministic gates passed. Do **not** retry those removals unless their importing code is intentionally replaced.

### AI personalisation (after Mr. Ranedeer-style ideas)

All on `main`, each with unit/integration tests and e2e checks; see CHANGELOG "Unreleased".

- desktop: class teaching profile (`src/shared/classAiProfile.ts`, migration 41), class evidence (`src/main/services/classEvidence.ts`), unit planner (`src/shared/unitPlan.ts`, `src/main/services/unitLessons.ts`, `UnitPlannerModal.tsx`), per-class Study Helper rules (`src/shared/studyHelperRules.ts`, migration 42, sent in each publish's `classes[].helperRules`);
- prompts live apart from the network calls so they can be tested (`src/main/services/lessonDraftPrompt.ts`);
- Portal: learning state (`portal/services/learningState.js`), helper settings (`portal/services/helperRules.js`), revision plans (`portal/services/revisionPlan.js`);
- rule: the teacher's own words may go in the system prompt; anything from students or class materials goes in the user turn inside a fenced block (`<class_materials>`, `<learning_state>`, `<student_profile>`, `<revision_inputs>`) with closing tags stripped;
- the desktop `publishStatus` integration test starts a real Portal and can pass 5 s under heavy parallel load (0.7 s alone); it is not flaky in isolation.

## Reusable-content architecture decision

The old handoff listed “teacher templates” for lessons, worksheets, quizzes, rubrics, comments and homework as if a new subsystem was required.

It is not.

Current EduBoard already covers those reuse needs through:

- saved lesson templates;
- global Resources + worksheet/practice/Offline Study Pack generation;
- reusable rubric library;
- reusable comment bank / ready-made sets;
- assignment reuse and cross-class homework copy.

Future work should make these systems easier to discover and use together, not duplicate them behind a second template model.

## Start here

Read:

1. **[HANDOFF.md](./HANDOFF.md)** — this file;
2. **[Next_Steps_ChatGPT.MD](./Next_Steps_ChatGPT.MD)** — authoritative next loop;
3. **[Project_Review.MD](./Project_Review.MD)** — v0.7.8 implementation/release evidence;
4. **[Changes_Made.MD](./Changes_Made.MD)** — v0.7.8 change record.

## Recommended next loop

Prioritize, in order:

1. **Batch offline-progress handling**
   - multi-file import;
   - duplicate/unmatched-name review;
   - class/resource progress summary;
   - remain local-file based and account-free.

2. **School Pack provenance**
   - pack version/source;
   - last-applied information;
   - fingerprint/hash;
   - clearer managed-vs-local settings;
   - no expansion into classroom data.

3. **Selective bulk feedback/roster operations**
   - only where current single-item APIs make behavior predictable;
   - preview/confirmation before mutation;
   - avoid broad “admin suite” expansion.

4. **Reuse UX unification**
   - make existing lesson/Resource/rubric/comment/homework reuse easier to find;
   - no new generic template storage layer.

5. **Measured native-package pruning**
   - use PR #55’s per-package composition report;
   - one native package at a time;
   - cross-platform smoke/validation required;
   - reject negligible savings.

6. **Persist package-size evidence**
   - retain JSON composition reports as build/release artifacts;
   - compare future releases directly with the v0.7.8 baseline.

## Feature-admission rule

Prefer additions that satisfy at least **4 of these 6**:

- repeatedly useful;
- meaningfully saves teacher/student time;
- works offline or degrades gracefully offline;
- reuses existing EduBoard data;
- adds no large runtime dependency;
- has broad teaching value.

The goal remains to improve teacher, school and optional student workflows **without turning EduBoard into a bloated all-in-one platform**.

## Packaging rule

Do not prune native package contents based on appearance alone.

For every pruning change:

- identify files that cannot load on the target OS/architecture;
- change one package at a time;
- measure before/after;
- require Windows, Linux, Apple Silicon Mac and Intel Mac validation as applicable;
- revert complexity when the saving is trivial.

## Security/release work stays separate

Keep Electron fuses/custom protocol, code signing/notarization, SBOM/provenance and branch-protection work in narrow dedicated loops rather than mixing them with classroom features.

## Handoff instruction for a new chat/agent

> Continue EduBoard from the current post-v0.7.8 `main` branch. Treat published v0.7.8 as the measured release baseline, but do not assume `main` is identical to that release: PRs #52–#55 added offline Study Pack progress returns, School Pack audit visibility, bulk archive/cross-class homework copy, and stronger package-composition reporting. Do not rebuild a generic template subsystem, and do not retry removing `@electron-toolkit/utils` or `date-fns`; real builds proved both are used. Work in small verifiable loops: plan → implement narrowly → deterministic tests → inspect actual behavior/measurements → document → merge only when green.
