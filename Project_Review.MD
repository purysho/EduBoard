# EduBoard Project Review

This file is the running engineering review for the iterative ChatGPT maintenance loop.

## Loop 1 — v0.7.4 “Verified Updates”

### Baseline reviewed

- Starting point: `main` at `6e15e453a56d0964336b317a699b3aecb1c84f0c`.
- Previous public release: `v0.7.3` at `ccbec7349db94a37b8a8b57d9c6eb0a911095588`.
- Post-release change: PR #36 hardened updater filenames and pending-update paths.
- No open pull requests or ordinary GitHub issues were present at review time.
- The `v0.7.3` release completed Windows, macOS and Linux builds with 19 uploaded assets and GitHub-provided SHA-256 digests.

### Recent work reviewed

The `0.7.3` line concentrated on offline-first teaching:
- teacher-authored study guides, flashcards and quizzes without AI;
- Word/WPS worksheet export;
- PowerPoint practice-deck export;
- WeChat/QQ destinations and capability-aware routing;
- per-destination routing mute.

The first post-`0.7.3` fix prevented release metadata and a tampered `pending.json` from choosing installer filesystem paths.

### Gaps and candidates

1. **Downloaded update integrity — selected for v0.7.4.**
   - The updater currently checks that the received byte count matches the release asset size.
   - Size detects truncation but not same-length corruption or substitution.
   - GitHub already reports a `sha256:<hex>` digest for release assets, including all `v0.7.3` installers.
   - The Portal relay currently drops that digest instead of forwarding it.
2. **Electron renderer sandbox — deferred.**
   - Main and print windows currently use `sandbox: false`.
   - This deserves a separate compatibility pass because preload functionality must be audited before changing it.
3. **Code signing/notarization — deferred/external dependency.**
   - Workflows are ready, but production certificates and repository secrets are still required.
4. **Branch protection / required checks — deferred repository policy work.**
   - `main` is not protected. Enabling required checks is desirable but should follow a deliberate required-check selection.
5. **Release provenance/SBOM — deferred.**
   - Useful after installer integrity verification is in place.

### Detailed implementation plan

1. Extend release-asset metadata with a validated SHA-256 digest.
2. Accept only GitHub-style `sha256:<64 hex>` values and normalize them.
3. Relay valid digests through `/api/app-release`; do not invent a digest when GitHub does not provide one.
4. Require a valid digest before EduBoard treats an asset as installable.
5. Calculate SHA-256 incrementally while downloading the bytes.
6. Reject an update whose calculated digest differs even when byte size is correct.
7. Persist the expected digest in `pending.json`.
8. Validate the persisted digest when reading a pending marker.
9. Re-hash a pending installer immediately before automatic or teacher-triggered execution so post-download modification is detected.
10. Keep hashing bounded-memory; do not read a ~200 MB installer into one Buffer.
11. Add tests for direct GitHub digest parsing, Portal digest relay, malformed/missing digests, correct downloads, same-size wrong-content downloads, tampered pending metadata, and same-size pending-file tampering.
12. Add a dedicated update-integrity error code and regenerate error-code documentation.
13. Document verified updates in security/user-facing documentation.
14. Bump desktop version to `0.7.4`, update the changelog and generated Portal desktop version.
15. Run lint, typecheck, desktop tests, Portal tests, E2E, dependency checks and CodeQL before merge.
16. Merge only if the full gate is green, then verify version-bump/release workflows and release assets.

### Plan review and amendment

The first draft was to verify the digest only during download. That is insufficient because a downloaded file could be modified before the next launch. The amended plan stores the expected digest and verifies the file again at the execution boundary.

Electron sandboxing and signing are intentionally not mixed into this patch because they affect a wider runtime surface and would make checksum regressions harder to isolate.


### Implementation review

The implementation followed the amended plan: GitHub/Portal digest metadata is normalized,
downloads are hashed while streaming, the expected digest is persisted, and pending files
are hashed again before execution.

A manual review found one adjacent recovery bug: when `readPending()` rejected a corrupt
marker and returned null, startup did not remove the invalid pending-update folder. The
startup clear path now removes the dedicated pending directory even when the marker could
not be parsed.

### CI and security review

Initial PR run:
- lint and typecheck passed;
- CodeQL Actions and JavaScript/TypeScript passed;
- dependency checks passed;
- Electron E2E passed;
- desktop tests had one failure in the new malformed-digest test fixture because the test
  wrote into a directory it had not created;
- the fixture was fixed and touched-file formatting was cleaned up.

Corrected PR run:
- lint: passed;
- typecheck: passed;
- desktop unit/integration tests: passed;
- Portal tests: passed;
- Electron E2E smoke test: passed;
- npm audit for shipped desktop dependencies: passed;
- npm audit for shipped Portal dependencies: passed;
- private-content guard: passed;
- CodeQL Actions: passed;
- CodeQL JavaScript/TypeScript: passed with no code-scanning annotations.

GitHub's optional “Code scanning AI findings” job failed repeatedly before analysis with
`400 The requested model is not supported` for GitHub's configured
`claude-opus-5[ReasoningEffort=medium]`. This is an external GitHub/Copilot service
failure; its logs contain no application-security finding. It is therefore documented,
not treated as a code defect and not made a release blocker while the deterministic
security checks are green.

### Loop 1 completion status

Code and requested documentation are complete on PR #37. A final docs-inclusive CI pass
must be green before merge. After merge, verify the automatic v0.7.4 release workflow,
all platform assets, digests and checksums, then begin Loop 2 from the released `main`.


## Loop 2 — v0.7.5 “Sandboxed Renderers”

### Baseline reviewed

- Starting point: released `main` at `24a72e855f150272f8f902a3d56ed83598c8655a`.
- `v0.7.4` release workflow completed successfully.
- Release `v0.7.4` published 19 Windows/macOS/Linux assets, all with GitHub SHA-256 digests and platform checksum files.
- Desktop/Portal dependency audits, private-content guard, Electron E2E and both CodeQL analyses were green before the v0.7.4 merge.
- GitHub's optional AI-security job still fails before code analysis because its configured `claude-opus-5` model is unsupported; that remains an external service issue, not an application finding.

### Current Electron security review

EduBoard is on Electron `^44.4.5`. Electron's current security guidance recommends renderer process sandboxing, context isolation, limited navigation, limited new-window creation and narrowly scoped preload bridges.

Current EduBoard state:
- both the main and print BrowserWindows explicitly opt out with `sandbox: false`;
- `contextIsolation` and `nodeIntegration` currently rely on Electron defaults rather than being explicit;
- `webSecurity` also relies on the default;
- new-window creation is already denied in the main window, with safe HTTP/HTTPS/mail links opened in the system browser;
- top-level navigation is not explicitly restricted;
- the preload exposes the app's typed `window.api` bridge **and** the broad `@electron-toolkit/preload` `electronAPI` bridge as `window.electron`.

### Compatibility audit

A complete scan of all 137 renderer TypeScript/JavaScript files found extensive use of `window.api` and **no use of `window.electron`**.

The preload itself uses only:
- Electron's `contextBridge` and `ipcRenderer`;
- bundled/shared EduBoard IPC constants and TypeScript types;
- the unused `@electron-toolkit/preload` import.

Electron's sandboxed preload environment supports `contextBridge` and `ipcRenderer`, but arbitrary external Node modules are intentionally restricted. Removing the unused `electronAPI` bridge therefore eliminates the only obvious sandbox incompatibility while also reducing exposed renderer capability.

One renderer action intentionally calls `location.reload()` after changing the UI language. Navigation controls must allow reload of the exact current app document while blocking navigation to any other document.

### Gaps and candidates

1. **Renderer sandbox + narrow preload — selected for v0.7.5.**
2. **Top-level navigation restriction — selected for v0.7.5** because it is part of the same BrowserWindow trust boundary.
3. **IPC sender validation — deferred to a dedicated loop.**
   - Electron recommends validating IPC senders.
   - EduBoard has a large IPC surface; sender validation should be centralized and tested rather than partially patched in this version.
4. **Electron fuses — deferred.**
   - Candidate hardening includes disabling RunAsNode/NodeOptions/CLI inspect capabilities at package time.
5. **Code signing/notarization — deferred/external credentials.**
6. **Branch protection / required checks — deferred repository-policy work.**
7. **Release provenance/SBOM — deferred.**

### Detailed implementation plan

1. Remove the unused `@electron-toolkit/preload` import and `window.electron` exposure from the preload.
2. Remove the matching `Window.electron` type declaration; keep the typed `window.api` bridge.
3. Define explicit BrowserWindow security preferences for all app-content windows:
   - `sandbox: true`;
   - `contextIsolation: true`;
   - `nodeIntegration: false`;
   - `webSecurity: true`;
   - the existing preload path.
4. Apply those preferences to both main and print windows.
5. Centralize webContents security setup so main and print windows receive the same navigation/window policy.
6. Continue denying renderer-created windows. Open only URLs already accepted by `isSafeExternalUrl` through `shell.openExternal`.
7. Add a `will-navigate` policy:
   - permit a reload/navigation only when protocol, host, pathname and search match the currently loaded EduBoard document;
   - ignore hash differences because HashRouter navigation is same-document and does not emit `will-navigate`;
   - prevent every other top-level document navigation;
   - when the target is an allowed HTTP/HTTPS/mail URL, hand it to the system browser instead of navigating EduBoard.
8. Add pure unit tests for exact-document navigation matching, including:
   - same file/dev URL with a different hash;
   - same document reload;
   - different local file;
   - different dev-server path/origin;
   - external HTTPS/mailto;
   - malformed URLs.
9. Extend Electron E2E to assert:
   - `process.sandboxed` is true in the preload/renderer environment (through a deliberately narrow diagnostic value if needed);
   - `window.electron` is absent;
   - `window.api` still works;
   - a same-document reload still works;
   - an attempted top-level navigation does not replace the EduBoard document.
10. Update `SECURITY.md`, changelog and user-facing technical notes.
11. Bump desktop version to `0.7.5` and sync Portal desktop version metadata.
12. Run lint, typecheck, desktop tests, Portal tests, Electron E2E, dependency checks, private-content guard and CodeQL.
13. Review any CI/security failure, amend code as needed, then write the versioned `Changes_Made.MD` and new `Next_Steps_ChatGPT.MD`.
14. Merge only after the final docs-inclusive gate is green, then verify the v0.7.5 platform release and return to step 1.

### Plan review and amendment

The first candidate was simply changing `sandbox: false` to `sandbox: true`. Review showed that would be incomplete: the preload also exposes an unused broad Electron bridge from an external package that is unnecessary for EduBoard and can conflict with sandboxed preload constraints. The amended plan removes that bridge first and makes the renderer's only privileged surface the existing typed `window.api`.

A blanket `will-navigate` denial was also rejected because EduBoard intentionally uses `location.reload()` when changing interface language. The navigation policy will therefore allow the exact current app document and deny everything else.


### Loop 2 implementation review

The final implementation matched the amended plan:
- the unused generic Electron bridge was removed;
- main and print windows share explicit sandbox/isolation webPreferences;
- renderer-created windows are denied;
- renderer-triggered top-level navigation is centrally classified;
- exact-document reloads remain allowed so the UI-language switch continues working.

A post-code review made one non-behavioral cleanup: `windows.ts` imports Electron's
`WebPreferences` type directly rather than relying on an ambient namespace.

### Loop 2 CI and security review

PR #38 results:
- lint: passed;
- typecheck: passed;
- desktop unit/integration tests: passed;
- Portal tests: passed;
- Electron build and E2E smoke test: passed;
- desktop npm audit: passed;
- Portal npm audit: passed;
- private-content guard: passed;
- CodeQL Actions: passed;
- CodeQL JavaScript/TypeScript: passed;
- aggregate CodeQL check: passed with 0 code-scanning annotations.

The E2E result is important for this loop: Electron successfully launched the real app
with the sandboxed preload, confirmed secure live webPreferences, retained the typed
`window.api` bridge, omitted `window.electron`, completed a renderer-triggered
same-document reload, and blocked an unsafe top-level document navigation.

The GitHub connection does not expose the private Security-tab alert-list REST endpoints,
so open code-scanning/Dependabot/secret-scanning lists could not be enumerated directly.
This limitation is recorded explicitly rather than inferred away.

GitHub's optional AI-security job failed before reviewing code. Its log again shows
`COPILOT_AGENT_MODEL: sweagent-capi:claude-opus-5[ReasoningEffort=medium]` followed by
`400 The requested model is not supported`. No application-security finding was
produced.

### Loop 2 completion status

Code, tests and requested documentation are complete on PR #38. Run one final
docs-inclusive gate, merge only if the deterministic checks remain green, verify the
automatic v0.7.5 release and all platform assets, then begin Loop 3 from released
`main`.


## Loop 3 — v0.7.6 “Native Mac Release Validation”

### Baseline reviewed

- Starting point: released `main` at `fdcd4abeea1798ff4051b8e8727065b17ad01a08` (v0.7.5).
- PR #38's application gates passed: lint, typecheck, desktop tests, Portal tests, Electron E2E, dependency audits, private-content guard and both CodeQL analyses.
- The v0.7.5 release itself did **not** complete successfully.
- Windows and Linux release jobs succeeded.
- The macOS builder produced and uploaded both arm64 and x64 DMG/ZIP artifacts successfully.
- The Mac job then failed while launching the x64 app **under Rosetta on an arm64 GitHub runner**. The app logged `ERR_FAILED (-2)` while loading the packaged renderer document.
- Because that smoke step failed, later Mac post-build steps were skipped. The public v0.7.5 release therefore has 17 assets rather than the normal 19: `EduBoard.dmg` and `SHA256SUMS-macos-latest.txt` are missing.

### Root-cause review

The release currently builds both Mac architectures on `macos-latest`, which is an arm64 runner, then treats an x64 GUI launch through Rosetta as the Intel runtime test.

That translated test is no longer a faithful target-environment test after renderer sandboxing. GitHub now provides standard native Intel runners (`macos-15-intel` and `macos-26-intel`) for public repositories. Native Intel validation is both more representative and more secure than weakening the app or passing `--no-sandbox` merely to make a Rosetta CI check succeed.

### Gaps and candidates

1. **Native Intel release validation — selected for v0.7.6.**
2. **Partial-release repair and asset verification — selected for v0.7.6.**
3. **IPC sender validation — deferred to the next application-security loop.**
4. **Electron fuses, signing/notarization, branch protection and provenance/SBOM — remain queued.**

### Detailed implementation plan

1. Refactor `tools/mac/smoke-test.sh` so it can validate a specific app/architecture when paths are supplied.
2. Keep structural/signature/native-module checks for both architectures produced by the arm64 builder.
3. On the arm64 build runner:
   - perform the full GUI startup test only for the native arm64 app;
   - do not treat a translated Rosetta GUI startup as authoritative;
   - retain the x64 native-module check under Rosetta as a packaging sanity check.
4. Add a separate `verify-mac-intel` release job on `macos-15-intel`:
   - wait for the build matrix to finish;
   - download the exact published `EduBoard-x64.zip` for the release tag;
   - extract it;
   - validate signature/native modules;
   - launch the x64 app natively and require it to stay running without startup errors.
5. Keep renderer sandboxing enabled. Do **not** add `--no-sandbox` to production validation.
6. Add a `Release asset repair` workflow triggered after every `Release` workflow completion:
   - identify the release tag from the completed run;
   - exit cleanly if no corresponding release exists;
   - download the published Mac DMG/ZIP assets;
   - recreate `EduBoard.dmg` from the exact published arm64 DMG when the compatibility alias is missing;
   - regenerate `SHA256SUMS-macos-latest.txt` from the exact published Mac installers;
   - upload/replace those two derived assets;
   - verify the expected core Windows, Mac and Linux assets are present;
   - fail loudly if a core installer is missing rather than pretending the release is healthy.
7. Keep the repair workflow idempotent so reruns are safe.
8. After merging, re-run the failed v0.7.5 Release job. Its expected Rosetta failure will complete the old workflow and trigger the new default-branch repair workflow, allowing v0.7.5 to be repaired without rebuilding or changing its existing binaries.
9. Verify v0.7.5 returns to the expected 19 assets and that the repaired checksum file/compatibility DMG are uploaded.
10. Bump app version to v0.7.6 so the new release pipeline is exercised end-to-end.
11. Run normal PR tests/security gates before merge.
12. Verify the v0.7.6 Release workflow succeeds, including the new native Intel job, and verify all expected assets/digests.
13. Update `Changes_Made.MD`, `Next_Steps_ChatGPT.MD`, and this review with final outcomes.

### Plan review and amendment

A tempting workaround was to launch the translated Intel app with `--no-sandbox`. That was rejected: Electron documents `--no-sandbox` as testing-only, and using it here would specifically stop validating the security boundary introduced in v0.7.5.

Another option was rebuilding x64 exclusively on an Intel runner. That is a larger packaging change and duplicates the established two-architecture Mac build path. The amended plan keeps the proven build process, but moves **runtime authority** to a native Intel runner and adds a post-release integrity/repair layer so one validation failure cannot silently omit derived release assets.


### Loop 3 implementation review

The implementation kept the established Mac packaging path but changed where runtime
authority lives. The arm64 builder still proves the x64 native dependencies load under
Rosetta, but only native arm64 is GUI-launched there. A separate `macos-15-intel` job
downloads and tests the exact published Intel ZIP natively.

A release finalizer was added rather than merely moving the two skipped commands earlier.
This is more resilient: it derives the compatibility DMG and macOS checksum from the
already-published binaries, then checks the complete asset set after any Release outcome.

PR review also added `bash -n tools/mac/smoke-test.sh` to normal test CI so Bash syntax
is not first exercised during a tagged release.

### Loop 3 CI and security review

PR #39 deterministic results:
- lint: passed;
- typecheck: passed;
- Mac release-script syntax: passed;
- desktop unit/integration tests: passed;
- Portal tests: passed;
- Electron E2E: passed;
- desktop npm audit: passed;
- Portal npm audit: passed;
- private-content guard: passed;
- CodeQL Actions: passed;
- CodeQL JavaScript/TypeScript: passed;
- aggregate CodeQL: passed with 0 code-scanning annotations.

GitHub's optional AI-security run again failed before analysis with
`400 The requested model is not supported` for
`claude-opus-5[ReasoningEffort=medium]`; it produced no application finding.

The GitHub connector still does not expose the private Security-tab alert-list endpoints,
so those lists cannot be directly enumerated. Available code-scanning/dependency/private
content evidence is green.

### Loop 3 completion status

Code and requested documentation are complete on PR #39. Run the final docs-inclusive
gate, merge if deterministic checks stay green, re-run the failed v0.7.5 Release workflow
to trigger the new repair finalizer, verify v0.7.5 has 19 assets, then verify the v0.7.6
release and native Intel validation before beginning Loop 4.


### Loop 3 post-release amendment — repair trigger recovery

The v0.7.6 release itself completed successfully with native Intel validation and all 19 expected assets. Re-running only the failed v0.7.5 Mac job reproduced the known Rosetta failure as expected, but GitHub did **not** emit a new `workflow_run: completed` event for that failed-job re-run. Therefore the new release-repair workflow did not run and v0.7.5 remained at 17 assets.

This is a workflow-trigger gap, not an application or packaging-integrity failure.

#### Amendment plan

1. Keep `workflow_run` as the normal automatic finalizer after future Release workflows.
2. Add `workflow_dispatch` with an optional explicit release tag so a specific published release can be repaired without rebuilding it.
3. Add a narrowly scoped `push` trigger for changes to the repair workflow itself. On that event, audit recent published releases and target any release that:
   - has all four canonical Mac installer archives (arm64/x64 DMG and ZIP), and
   - is missing either derived `EduBoard.dmg` or `SHA256SUMS-macos-latest.txt`.
4. Refactor the repair shell logic to support one explicit tag or an audit-discovered tag list.
5. Preserve idempotency: derived assets use `--clobber`; releases already complete are verified and otherwise left unchanged.
6. Never rebuild old installers. Repair only derives files from the exact binaries already published for that tag.
7. Verify the complete 19-asset set after repair.
8. Run normal PR CI/CodeQL, merge, confirm the main-push audit repairs v0.7.5, and re-check all v0.7.5 asset digests/states.
9. Record the outcome in `Changes_Made.MD`, `Next_Steps_ChatGPT.MD`, and this review before beginning Loop 4.

#### Amendment review

A broader always-on push audit was considered and rejected because release builds are asynchronous: a routine source push can occur while a release is still assembling assets. Limiting push-triggered auditing to changes of the repair workflow itself avoids racing ordinary releases. Normal release completion remains owned by the `workflow_run` trigger, while `workflow_dispatch` provides an explicit recovery path for future historical repairs.


#### Amendment implementation and CI review

The repair logic was extracted to `tools/release/repair-release-assets.sh`. Normal
`workflow_run` completion remains the default release-finalization path. An explicit
tagged `workflow_dispatch` path was added for historical recovery, plus a narrow
`main` push audit that runs only when the repair tooling itself changes.

Audit mode refuses to infer a repair from only the four Mac files. It requires the full
17-asset canonical core set (the expected v0.7.x release minus the two derived Mac
assets), skips drafts/non-`v*` tags, and only then reconstructs the derived pair. This
prevents older or structurally different releases from being silently coerced into the
current release format.

PR #40 deterministic validation:
- lint: passed;
- typecheck: passed;
- Mac smoke-test Bash syntax: passed;
- release-repair Bash syntax: passed;
- desktop unit/integration tests: passed;
- Portal tests: passed;
- Electron E2E: passed;
- desktop and Portal npm audits: passed;
- private-content guard: passed;
- CodeQL Actions: passed;
- CodeQL JavaScript/TypeScript: passed.

The final docs-inclusive gate must remain green before merge. After merge, the repair
workflow's path-scoped main-push trigger should audit recent releases, repair v0.7.5,
and prove the release has all 19 expected assets before Loop 4 begins.


#### Repair audit post-merge defect and correction

The path-scoped main-push audit successfully repaired v0.7.5 from 17 to 19 assets. The two derived files were recreated from the already-published Mac binaries:
- `EduBoard.dmg`;
- `SHA256SUMS-macos-latest.txt`.

However, the repair workflow itself ended with exit code 1 **after** successful verification. The log showed:
`tools/release/repair-release-assets.sh: line 104: dir: unbound variable`.

Root cause: `repair_tag()` installed a Bash `RETURN` trap referring to its local `dir`. The trap remained active after `repair_tag()` returned and fired again when `audit_recent()` returned, after the local variable no longer existed under `set -u`.

Correction plan:
1. Run each `repair_tag()` invocation in a subshell.
2. Use an `EXIT` cleanup trap local to that subshell, preventing cleanup state from leaking to callers.
3. Add a fully local regression test with a mocked `gh` command that:
   - presents a 17-asset v0.7.5-style release;
   - runs the real `--audit-recent` path;
   - verifies both derived assets are created and the process exits successfully;
   - runs the audit again and verifies it is idempotent.
4. Execute this regression in normal PR CI, not only Bash syntax checking.
5. Merge only with deterministic tests and CodeQL green, then run the repair workflow explicitly against the now-complete v0.7.5 release and require a green no-op result.


## Loop 4 — v0.7.7 “Trusted IPC Boundary”

### Baseline reviewed

- Starting point: released `main` at `c6145e3c8ed1888bc3f34485a1198a77f69130c1` (v0.7.6).
- v0.7.6 Release succeeded across Windows, Linux, native arm64 Mac, and native Intel Mac; all 19 release assets are present.
- During this loop, the release-repair follow-up completed: v0.7.5 was restored from 17 to the full 19 assets without rebuilding its canonical installers, and the cleanup-trap regression was fixed so a successful no-op repair now exits green.
- Renderer sandboxing, context isolation, navigation containment, and safe external-link handling are already in place from v0.7.5.
- All async renderer-to-main calls are registered through the single `handle()` wrapper in `src/main/ipc/register.ts`.
- The only direct synchronous renderer IPC is `i18n:prefs` in `src/main/i18n.ts`.
- The preload exposes only typed `window.api` methods and a boot-time UI preference object.

### Current security guidance reviewed

Electron's current security checklist explicitly recommends validating the sender of every IPC message. The guidance notes that web frames, including child frames in some configurations, can send IPC and recommends validating the frame/origin before privileged work or data access. EduBoard already blocks unexpected top-level navigation, but IPC sender validation should be an independent trust boundary rather than relying on navigation policy alone.

### Gaps and candidates

1. **Central IPC sender validation — selected for v0.7.7.**
2. **Synchronous `i18n:prefs` sender validation — selected for v0.7.7.**
3. **Remove unused `@electron-toolkit/preload` dependency — selected as cleanup because v0.7.5 removed its final import.**
4. **Custom local protocol instead of `file://` — deferred.** Electron recommends it, but this changes renderer loading/build semantics and should be isolated in its own loop.
5. **Electron fuses — deferred to the next security loop.**
6. **Signing/notarization, branch protection, provenance/SBOM — remain queued.**

### Detailed implementation plan

1. Add one main-process IPC trust module.
2. Register each EduBoard app/print `WebContents` as trusted at window creation time, together with the exact app document it is allowed to host.
3. Remove a trusted entry when its `WebContents` is destroyed.
4. For every incoming IPC message require all of:
   - the sending `WebContents` is one EduBoard created and registered;
   - `senderFrame` still exists and is not destroyed/detached;
   - the sender is the `WebContents.mainFrame`, not an iframe/child frame;
   - the frame's exact document matches the registered EduBoard document, ignoring only the hash route.
5. Keep the trusted document explicit:
   - packaged builds: the exact built `renderer/index.html` file URL;
   - development: the exact configured `ELECTRON_RENDERER_URL`.
6. Add validation at the existing `handle()` wrapper before lock-state checks or handler arguments reach repositories/services. This automatically covers the entire async typed IPC API.
7. Add the same validation to synchronous `i18n:prefs`; an untrusted sender receives no UI settings.
8. Return a dedicated `EB-0006` error for blocked async IPC and document it.
9. Add pure tests for trusted/untrusted sender snapshots, including:
   - registered main frame + exact app document => allow;
   - unknown WebContents => deny;
   - child frame => deny;
   - missing/destroyed/detached frame => deny;
   - same trusted window after navigation to another document => deny;
   - hash-only route differences => allow.
10. Extend Electron E2E to prove ordinary `window.api` calls still work and, if feasible without weakening the renderer, exercise a rejected child-frame IPC attempt.
11. Remove the unused `@electron-toolkit/preload` runtime dependency and lockfile entry.
12. Update README/SECURITY documentation and changelog.
13. Bump desktop + Portal-advertised version to `0.7.7`.
14. Run lint, typecheck, desktop/Portal tests, Electron E2E, Mac release-script syntax, dependency checks, private-content guard, and CodeQL.
15. Review GitHub security results; fix any real finding. Continue to distinguish the known GitHub AI-review unsupported-model service error from application findings.
16. Write/refresh `Changes_Made.MD`, `Next_Steps_ChatGPT.MD`, and this review with final results.
17. Merge only with deterministic gates green, verify the v0.7.7 release/assets, then return to step 1.

### Plan review and amendment

A URL-only allowlist would be weaker than necessary: a renderer not created by EduBoard could in principle load the same URL. The plan therefore combines **window identity + main-frame identity + exact document identity**.

Origin-only validation is also insufficient for the packaged `file://` case because unrelated local files can share file-scheme origin characteristics. Until EduBoard moves to a custom local protocol, the packaged check will require the exact renderer file document in addition to a registered `WebContents`.

The synchronous language bootstrap stays synchronous for this loop because changing renderer initialization timing would widen the regression surface. It will receive the same sender gate rather than being redesigned at the same time.


### Implementation review

The implementation centralizes trust rather than duplicating checks across roughly 260 typed IPC handlers:

- `src/main/ipc/senderValidation.ts` keeps a registry of EduBoard-created `WebContents` and the exact app document each one may host.
- Main and print windows register themselves as trusted at creation and are removed from the registry when destroyed.
- The async `handle()` boundary rejects a request before lock-state checks or handler arguments reach services unless the sender is:
  - a registered EduBoard `WebContents`;
  - a live, attached frame;
  - the window's main frame rather than a child frame;
  - still on the exact registered app document, with hash-only route differences allowed.
- Synchronous `i18n:prefs` uses the same gate and returns no preferences to an untrusted sender.
- Packaged document identity uses the exact `file://.../renderer/index.html` URL; development uses the configured Vite renderer URL.
- `@electron-toolkit/preload` was removed from the runtime dependency graph because v0.7.5 removed its final import.
- `EB-0006` identifies blocked async IPC requests and has a Chinese user-facing translation.

The code review tightened live-frame handling so `senderFrame`, `mainFrame`, URL, detached state and destroyed state are captured immediately at the event boundary and any unavailable property fails closed. This matches Electron's warning that a sender frame may become null/detached during navigation.

### Loop 4 tests and security review

Initial PR #41 deterministic gate:
- lint: passed;
- typecheck: passed;
- Mac release-script syntax/regression checks: passed;
- desktop unit/integration tests: passed;
- Portal tests: passed;
- Electron E2E: passed;
- desktop npm audit: passed;
- Portal npm audit: passed;
- private-content guard: passed;
- CodeQL Actions: passed;
- CodeQL JavaScript/TypeScript: passed;
- aggregate CodeQL: passed with 0 code-scanning annotations.

Sender-validation regression coverage includes:
- registered main frame on the exact app document;
- development renderer URL;
- hash-route changes;
- unknown WebContents;
- child frames;
- missing/destroyed/detached frames;
- a registered window after unexpected document navigation.

GitHub's optional AI-security job again failed in its service path rather than reporting an application finding. The deterministic CodeQL result is green.

### Release-repair prerequisite outcome

Before v0.7.7 merges, the v0.7.5 historical release is now complete at 19 assets. The first successful repair exposed a Bash cleanup-trap leak after verification; PR #42 changed the repair function to a subshell-scoped `EXIT` trap and added a mocked-GitHub regression test. After that merge, the path-scoped repair workflow ran again against the already-complete release and exited successfully as an idempotent no-op.

### Loop 4 completion status

The implementation and required handoff documents are complete. A final docs-inclusive PR gate must be green before merge. After merge, verify the v0.7.7 Release workflow, native Intel Mac validation, the full 19-asset release set and GitHub security checks, then begin Loop 5 from released `main`.


### v0.7.7 post-release verification

v0.7.7 was merged at `57eabac34219bacab4f62217717b6789b4a7675a`; tag `v0.7.7` points to that exact commit.

Release verification:
- Release workflow: passed;
- Windows build/publish: passed;
- Linux build/publish: passed;
- macOS build/publish: passed;
- native Intel Mac validation of the exact published x64 ZIP: passed;
- main-branch tests/E2E: passed;
- dependency audits: passed;
- private-content guard: passed;
- CodeQL Actions and JavaScript/TypeScript: passed;
- release asset count: 19/19;
- every published asset reports `state: uploaded` and a SHA-256 digest.

The separate `Release asset repair` workflow did not auto-start from the completed Release run. The release itself was already complete, so this did not affect v0.7.7. To remove cross-workflow trigger ambiguity, release completeness is being moved into an explicit `finalize-release` job in the Release workflow itself. The standalone repair workflow remains only for manual/historical recovery and the path-scoped audit used when repair tooling changes.

This is a post-release tooling correction; it does not rebuild, replace or retag any v0.7.7 binary.
