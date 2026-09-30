# Changes Made — EduBoard v0.7.4 “Verified Updates”

## Purpose

v0.7.4 closes the integrity gap between discovering an update and executing its installer.
Previous versions validated the downloaded file's size. v0.7.4 also validates the
SHA-256 digest GitHub publishes for the exact release asset and checks it again at the
execution boundary.

## Security changes

- GitHub release asset `digest` metadata is now carried into the desktop updater.
- Portal-assisted update checks relay the same digest rather than dropping it.
- SHA-256 values are accepted only in canonical `sha256:<64 hex>` form and normalized.
- Downloads are hashed incrementally while streaming, so installer-sized files are not
  loaded into memory at once.
- A file with the right byte count but the wrong content is rejected and deleted.
- Missing or malformed digest metadata stops installation with `EB-3007`.
- The expected digest is persisted in `pending.json`.
- Pending installers are re-hashed immediately before automatic startup installation
  and before a teacher-triggered “Restart and update now”.
- Corrupt/unreadable pending-update state is cleared on launch so the updater can recover.

## Tests added or extended

- SHA-256 normalization and malformed digest rejection.
- Direct GitHub release digest parsing.
- Portal digest relay.
- Successful verified download.
- Same-size, wrong-content download rejection and deletion.
- Missing digest rejection before a network download begins.
- Pending metadata digest validation.
- Same-size pending-file tampering detected before execution.
- Existing updater path-traversal/unsafe-filename coverage remains in place.

## Documentation and user-facing changes

- Added `EB-3007` to the desktop error catalog and generated error-code documentation.
- Added Chinese text for the integrity failure.
- Updated `SECURITY.md` and the README to describe verified automatic updates.
- Added the v0.7.4 changelog entry.
- Updated desktop and Portal-advertised version metadata to `0.7.4`.

## Review and CI

The first PR run exposed one test-fixture error: the malformed-marker test attempted to
write `pending.json` before creating its directory. The fixture was corrected using the
production `writePending` helper.

After that correction:
- lint: passed;
- TypeScript typecheck: passed;
- desktop unit/integration suite: passed;
- Portal suite: passed;
- Electron E2E smoke test: passed;
- desktop production dependency audit: passed;
- Portal production dependency audit: passed;
- CodeQL JavaScript/TypeScript: passed;
- CodeQL GitHub Actions: passed;
- private-content guard: passed.

GitHub's separate “Code scanning AI findings” job failed before code analysis because its
runner requested an unsupported `claude-opus-5` model. The log contains a GitHub/Copilot
`400 The requested model is not supported` error and no security finding. This is
recorded as an external CI-service issue rather than suppressed or misreported as a code
failure.

## Version

**EduBoard v0.7.4 — Verified Updates**
