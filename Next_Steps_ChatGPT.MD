# Next Steps — ChatGPT

## Next loop target

Return to step 1 on the released post-v0.7.5 `main`.

### Highest-priority candidate: validate IPC senders

Electron's security checklist recommends validating the sender of every IPC message.
EduBoard has a deliberately large typed IPC surface, so the next loop should solve this
centrally rather than editing hundreds of handlers independently.

Before changing code:

1. Inventory every `ipcMain.handle`, `ipcMain.on`, and registration helper.
2. Determine how handlers are currently registered and whether one wrapper can validate
   `event.senderFrame` / `event.sender` for all app IPC.
3. Define the trusted sender rules for:
   - packaged `file://.../renderer/index.html`;
   - the pinned development renderer `http://127.0.0.1:5173/`;
   - main and print windows;
   - startup synchronous IPC such as `i18n:prefs`.
4. Reject calls from unexpected webContents/frame URLs before arguments reach repositories
   or services.
5. Add unit tests for sender URL decisions and integration/E2E coverage for valid app IPC.
6. Ensure the solution does not break print windows, lock/unlock, sample school, or
   offline operation.
7. Record the full plan in `Project_Review.MD` before implementation.

### Other queued gaps

- **Electron fuses:** evaluate disabling RunAsNode, NODE_OPTIONS and CLI inspect behavior
  in packaged builds.
- **Remove unused preload dependency:** once sandboxing has shipped successfully, remove
  the now-unused `@electron-toolkit/preload` package and update the lockfile cleanly.
- **Code signing/notarization:** workflow support exists; production credentials are still
  required.
- **Branch protection:** select stable required checks; do not require the currently
  broken GitHub AI-security service job.
- **Release provenance/SBOM:** add build provenance and a software bill of materials.
- **GitHub AI-security check:** re-check only for service recovery; do not alter app code
  to compensate for its unsupported-model configuration.

## Loop rule

Keep each release focused. Security-boundary work should be centralized and testable,
with real Electron E2E evidence before merge.
