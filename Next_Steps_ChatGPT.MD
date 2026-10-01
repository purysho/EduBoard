# Next Steps — ChatGPT

## Next loop target

Return to step 1 on the released post-v0.7.7 `main`.

### First verification

Before new code:
1. Confirm the v0.7.7 tag points to the merged commit.
2. Confirm Release, native Intel Mac validation, tests, dependency checks and CodeQL are green.
3. Confirm all 19 expected release assets are uploaded with digests.
4. Confirm the release-repair finalizer is green/idempotent.
5. Record those results in `Project_Review.MD`.

### Highest-priority candidate: Electron production fuses

Electron's security checklist recommends reviewing Electron fuses. The next narrow
security loop should evaluate hardening the packaged binary so production builds cannot
silently regain debugging/Node entry points through environment variables or CLI flags.

Before coding:
1. Review Electron 44's current fuse set and `@electron/fuses` documentation.
2. Audit EduBoard launch/update/test workflows for any legitimate dependency on:
   - `ELECTRON_RUN_AS_NODE`;
   - `NODE_OPTIONS`;
   - `--inspect` / `--inspect-brk`;
   - loading app code outside the packaged ASAR.
3. Choose only fuses compatible with Windows installer/portable, macOS arm64/x64 and Linux AppImage.
4. Plan how electron-builder flips/verifies fuses after packaging.
5. Add packaged-binary verification on all release platforms, not only unit tests.
6. Record the complete plan in `Project_Review.MD` before implementation.

### Other queued gaps

- **Custom local protocol:** replace packaged `file://` renderer loading with a privileged
  app protocol in its own loop; preserve hash routing and print routes.
- **Code signing/notarization:** requires production Windows/macOS credentials and repo secrets.
- **Branch protection:** choose stable deterministic required checks; do not require the
  currently broken GitHub AI-security service.
- **Release provenance/SBOM:** generate machine-verifiable provenance and an SBOM.
- **Content Security Policy review:** confirm the packaged renderer has a restrictive CSP
  appropriate for all offline and Portal-linked features.

## Loop rule

Keep each security release narrow, test the actual packaged binaries on their target
platforms, and never weaken a production boundary merely to make a translated or synthetic
CI environment pass.


## Release-finalizer trigger follow-up

The v0.7.7 Release workflow completed successfully and published all 19 expected assets, but the `Release asset repair` workflow did not receive/start its expected automatic `workflow_run` finalizer event.

At the start of the next loop:
1. Confirm whether GitHub suppresses this workflow chain because the Release workflow was itself dispatched by the repository's `GITHUB_TOKEN`.
2. If so, replace the fragile chained trigger with a deterministic mechanism that still preserves least privilege, such as:
   - calling the repair/verify script as the final job of the Release workflow itself; or
   - dispatching the repair workflow explicitly with a token/event that is allowed to start a second workflow.
3. Keep `workflow_dispatch` for historical/manual recovery.
4. Preserve the existing mocked-GitHub repair regression and 19-asset completeness check.
5. Do not change already-published v0.7.7 artifacts unless a genuine completeness/integrity problem is found.
