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
