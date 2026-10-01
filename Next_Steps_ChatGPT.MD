# Next Steps — ChatGPT

## Next loop target

Return to step 1 on the released post-v0.7.6 `main`.

### Highest-priority candidate: centralized IPC sender validation

Electron's security checklist recommends validating IPC message senders. EduBoard has a
large typed IPC surface, so v0.7.7 should solve this at the registration boundary rather
than adding inconsistent checks to individual handlers.

Before changing code:

1. Inventory every `ipcMain.handle`, `ipcMain.on`, `ipcMain.once` and any wrapper
   used to register them.
2. Inventory synchronous IPC, especially `i18n:prefs`.
3. Define trusted renderer-document rules for:
   - packaged `file://.../renderer/index.html`;
   - development `http://127.0.0.1:5173/`;
   - main and print windows;
   - exact-document reloads already permitted by the navigation policy.
4. Centralize validation around `event.senderFrame` / `event.sender`, rejecting
   unexpected documents before arguments reach repositories or services.
5. Do not trust an arbitrary URL string alone when a destroyed/missing frame or unrelated
   webContents can be rejected more strongly.
6. Add pure tests for trusted/untrusted sender decisions.
7. Add integration/E2E evidence that normal `window.api` calls, printing, lock/unlock,
   sample school and offline workflows remain functional.
8. Review whether `ipcRenderer.sendSync('i18n:prefs')` can be retained safely or should
   move to a preload-initialization pattern.
9. Record the complete plan in `Project_Review.MD` before coding.

### Other queued gaps

- **Remove unused dependency:** `@electron-toolkit/preload` is no longer imported after
  v0.7.5 and can be removed from dependencies/lockfile.
- **Electron fuses:** evaluate disabling RunAsNode, NODE_OPTIONS and CLI inspection in
  packaged builds after IPC sender validation.
- **Code signing/notarization:** requires production signing credentials/repository
  secrets.
- **Branch protection:** select stable deterministic required checks; do not require the
  currently broken GitHub AI-security service.
- **Release provenance/SBOM:** add build provenance and a software bill of materials.
- **GitHub AI-security check:** re-check for service recovery only; do not modify
  application code to compensate for its unsupported-model configuration.

## Loop rule

Keep each release narrow and test the actual trust boundary on the hardware/environment it
is meant to protect.


## Release-repair handoff

Before beginning the v0.7.7 IPC-sender work, verify the post-v0.7.6 repair-tooling merge
triggered **Release asset repair** on `main` and that v0.7.5 now contains all 19 expected
assets. If the audit itself fails, fix the repair tooling first; do not rebuild or replace
the canonical v0.7.5 installers.
