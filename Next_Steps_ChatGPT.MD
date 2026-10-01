# Next Steps — ChatGPT

## Next loop

Start from the released post-v0.7.8 main branch and review actual size measurements before making another trimming decision.

### Product candidates

Prioritize low-system-cost workflows:

1. **Offline student progress return**
   - exported Study Pack records student-local completion;
   - student exports a tiny progress file;
   - teacher imports it without an account/server requirement.
2. **Reusable teacher templates**
   - lesson;
   - worksheet;
   - quiz;
   - rubric;
   - feedback/comment bank;
   - homework.
3. **School Pack refinement**
   - make school-wide policy/default configuration easier to install and audit;
   - avoid duplicating classroom/teacher data.
4. **Bulk workflow improvements**
   - duplicate work across classes;
   - bulk archive;
   - bulk feedback / roster operations where current APIs already support it.

Use the feature-admission rule: repeated use, meaningful time saving, offline/graceful offline, existing data reuse, no large runtime dependency, broad teaching value. Aim for at least four of six.

### Size/performance candidates

Use v0.7.8 measurements before changing dependencies.

1. Compare v0.7.7 and v0.7.8 installer/AppImage/DMG sizes.
2. Run the composition report against unpacked platform packages and record:
   - Electron runtime;
   - locales;
   - app.asar;
   - native modules;
   - production node_modules.
3. Confirm whether `@electron-toolkit/utils` and `date-fns` are genuinely unused before removing them.
4. Evaluate selective bundling of pure-JS main-process libraries with electron-vite 5 one package at a time.
5. Keep native modules such as SQLite/canvas external unless a package-specific test proves otherwise.
6. Add route-level lazy loading only where it improves startup/memory; do not count it as installer-size reduction.
7. Tighten CI size thresholds only after multiple stable releases establish normal variance.

### Security/release follow-up

- Continue evaluating Electron production fuses and custom local protocol in separate narrow loops.
- Keep signing/notarization, provenance/SBOM and branch-protection work separate from classroom features.


### Native-package pruning evidence

The v0.7.8 Windows composition report showed that some native dependencies still carry files for other operating systems/targets inside the packaged app (for example a Linux-musl SQLite prebuild in the Windows package).

For the next size loop:
1. inventory `app.asar.unpacked/node_modules` per platform;
2. identify only files that can never be loaded on that target OS/architecture;
3. use electron-builder packaging rules or package-specific configuration to exclude them;
4. change one native package at a time;
5. require Windows installer smoke, native arm64 Mac smoke, native Intel Mac validation and Linux AppImage smoke after each pruning change;
6. compare installer size before/after each package so unnecessary complexity is rejected when savings are trivial.
