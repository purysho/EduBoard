# Next Steps — ChatGPT

## Next loop target

Return to step 1 on the post-v0.7.4 `main` branch.

### Highest-priority candidate: Electron renderer sandbox

The current main and print BrowserWindows explicitly use `sandbox: false`. The next loop
should determine whether EduBoard's preload bridge can run under Electron's renderer
sandbox and, if so, enable it without reducing offline functionality.

Before changing code:

1. Re-read the current `src/preload` implementation and every BrowserWindow constructor.
2. Check the current Electron security guidance for sandbox, context isolation,
   navigation control and external-link handling.
3. Inventory preload imports that rely on unrestricted Node APIs.
4. Check whether any renderer page intentionally navigates the main window away from the
   local EduBoard app.
5. Write the full plan into `Project_Review.MD` before implementation.

Likely implementation candidates, subject to that review:

- change main and print windows to `sandbox: true` if the preload is compatible;
- explicitly retain `contextIsolation: true` and `nodeIntegration: false` rather than
  relying only on Electron defaults;
- deny unexpected top-level navigation and open safe HTTP/HTTPS/mail links through the
  existing external-link allowlist;
- add regression tests for the BrowserWindow security options and navigation policy.

### Other queued gaps

- **Code signing/notarization:** workflow support exists; requires real Windows/macOS
  signing credentials and repository secrets.
- **Branch protection:** choose and require the stable CI checks on `main`; avoid making
  the currently broken GitHub AI-security service check mandatory.
- **Release provenance/SBOM:** add machine-verifiable build provenance and a software bill
  of materials after the update/download trust path is complete.
- **AI-security GitHub check:** re-check whether GitHub fixes the unsupported-model
  configuration. Do not change application code merely to make that infrastructure error
  disappear.

## Loop rule

Keep each version narrow enough that a failure has an obvious cause. Security/runtime
changes should not be bundled with unrelated classroom features.
