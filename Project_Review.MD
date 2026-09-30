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
