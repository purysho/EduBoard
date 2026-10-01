# Next Steps — ChatGPT

## Current post-v0.7.8 state

The original next-step loop is now substantially complete on `main`.

Completed and merged:

1. **PR #52 — Offline Study Pack progress returns**
   - students export a tiny JSON progress file from the standalone Offline Study Pack;
   - teachers import it from Resources without accounts, a server, or internet;
   - imports are validated against the originating Resource;
   - exact unique roster-name matches are linked automatically, otherwise progress remains name-only;
   - returned flashcard/quiz summary progress is visible per Resource.

2. **PR #53 — Auditable School Pack imports**
   - import preview now shows what configuration the pack contains;
   - it explicitly shows classroom/operational data the pack never contains;
   - it separately shows what the current import will change;
   - School Pack scope remains policy/default configuration only.

3. **PR #54 — Bulk teacher workflows**
   - multiple classes can be archived in one action using the existing class update path;
   - homework can be copied to multiple active classes;
   - copied homework keeps title, instructions, attachment, rubric, topic and quick-check questions;
   - copies are deliberately created as drafts with no due date so they cannot be published accidentally.

4. **PR #55 — Better package-composition evidence**
   - the composition report now separates Electron/runtime support, locales, `app.asar`, native binaries and packaged Node modules;
   - `app.asar.unpacked/node_modules` is reported package-by-package;
   - Windows test builds and release builds run the report against unpacked platform output when available.

All deterministic PR gates for these merged changes were green before merge.

## Template priority — closed as an architecture decision

Do **not** build a second generic template engine merely to satisfy the old checklist.

EduBoard already has the reusable structures the checklist was asking for:

- **lesson** — built-in + teacher-saved lesson templates;
- **worksheet** — global Resources plus editable DOCX worksheet export;
- **quiz/practice** — Resource practice sets, projector decks and Offline Study Packs;
- **rubric** — reusable rubric library;
- **feedback/comments** — reusable comment bank and ready-made comment sets;
- **homework** — existing assignment reuse plus PR #54 cross-class copy.

Future work should improve discovery and convenience around these existing systems, not duplicate their data models.

## Dependency-pruning verdict — closed

The old plan asked whether `@electron-toolkit/utils` and `date-fns` could be removed.

Both removal experiments were run through the real build and both failed for legitimate imports:

- `@electron-toolkit/utils` is required by `src/main/index.ts`;
- `date-fns` is required by `src/renderer/src/pages/Calendar/CalendarPage.tsx`.

Both dependencies were restored and the final PR was green. Do not reopen these two removals unless the importing code itself is deliberately rewritten.

## Recommended next product loop

Keep the same feature-admission rule: prefer work that is repeatedly useful, saves meaningful teacher/student time, works offline or degrades gracefully, reuses existing data, adds no large dependency, and has broad teaching value.

### 1. Batch offline progress return

The first progress-return implementation is intentionally small. The next useful step is teacher-scale handling:

- import several returned progress files in one action;
- show duplicates and already-imported files before committing;
- surface unmatched/ambiguous student names for manual linking;
- provide a class/resource summary view rather than opening one Resource at a time;
- keep the format local-file based and account-free.

Do not turn this into a cloud sync/account system.

### 2. School Pack provenance and managed-config clarity

Keep School Packs limited to school-wide defaults/policy.

Useful additions:

- show pack format/version and source filename in the audit preview;
- record when a managed/imported pack was last applied;
- show a small fingerprint/hash so IT can confirm two machines received the same pack;
- distinguish managed/locked values from teacher-local values clearly;
- never add classes, students, grades, homework, messages or credentials to the pack.

### 3. High-value bulk feedback / roster operations

Add bulk operations only where the existing APIs and data model make them safe.

Candidates:

- apply a comment-bank phrase or feedback status across selected submissions;
- bulk enrollment-status changes for selected students;
- bulk move/copy selected reusable Resources to a class/lesson association;
- batch resolve unmatched offline-progress names.

Every bulk action should have an explicit preview/confirmation and should reuse the existing single-item operation where practical.

### 4. Unify reuse UX without a new template subsystem

The underlying reusable systems already exist. Improve discoverability instead:

- standardize labels such as **Reuse**, **Copy to classes**, **Save as template** and **Use ready-made set**;
- consider one lightweight “Reusable content” entry point that links to lessons, Resources, rubrics, comments and homework;
- do not introduce a second storage model simply for a prettier gallery.

### 5. Evidence-driven native-package pruning

PR #55 now gives the right report. Use it before any exclusion rule.

For each platform:

1. record `app.asar.unpacked/node_modules` package sizes;
2. inspect only the largest native packages first;
3. identify files that provably cannot load on that OS/architecture;
4. exclude one package/target combination at a time;
5. rebuild and compare installer/package size;
6. require:
   - Windows installer smoke;
   - Linux AppImage smoke;
   - native Apple Silicon Mac smoke;
   - native Intel Mac validation;
7. reject the rule if the saving is trivial or maintenance complexity rises.

Keep SQLite/canvas native binaries external unless a package-specific test proves a narrower packaging rule is safe.

### 6. Package-size history rather than guesswork

A useful follow-on to PR #55 is to retain the JSON composition report as a CI artifact for releases/test builds.

That would make it possible to compare:

- total unpacked size;
- `app.asar`;
- locales;
- native binaries;
- per-package `app.asar.unpacked`;
- installer size;

across releases without manually reconstructing the evidence later.

Only tighten size budgets after several stable releases establish realistic variance.

## Performance and security follow-up

Keep these as separate narrow loops from classroom features:

- evaluate Electron production fuses;
- evaluate a custom local protocol if it materially improves security/packaging;
- measure startup/memory before adding route-level lazy loading;
- keep signing/notarization, SBOM/provenance and branch protection independent of teacher workflows.

Do not count route lazy loading as an installer-size win unless measurement actually shows one.

## Release guidance

The published **v0.7.8 Lean Core** remains the measured release baseline.

The features above PR #52–#55 are post-v0.7.8 `main` work. Do not relabel the old release. When the next coherent release is prepared:

- choose the version deliberately;
- rerun the full cross-platform release validation;
- capture the new package-composition evidence;
- compare against v0.7.8;
- document both product gains and package-size movement.

## What not to redo

- Do not reopen the validated v0.7.8 locale/dependency-placement cuts without new evidence.
- Do not try removing `@electron-toolkit/utils` or `date-fns` again without first changing their live imports.
- Do not create a second generic template framework.
- Do not add cloud accounts merely to return offline Study Pack progress.
- Do not prune native package files based only on filenames; prove they cannot load on that target.
- Do not accept feature bloat just because a workflow is technically possible.

## Working method

Continue using small, verifiable loops:

**plan → implement narrowly → deterministic tests → inspect measurements/behavior → document → merge only when green**

For packaging changes, add the relevant native platform smoke/validation before calling the change complete.
