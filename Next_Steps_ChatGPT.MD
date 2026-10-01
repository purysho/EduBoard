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


## Measurements now available

Use these v0.7.8 facts when choosing the next optimization:
- compiled app output: 3.63 MiB;
- renderer JS: 2.84 MiB;
- main/preload JS: 0.74 MiB;
- packaged Windows `app.asar`: 122.58 MiB;
- unpacked packaged node_modules: 67.86 MiB;
- production dependency count: 11;
- Electron locales: already reduced to 3 files / 1.68 MiB.

This means further meaningful savings are unlikely to come from minifying EduBoard UI code.

### Next safe size investigations

1. Verify whether `@electron-toolkit/utils` and `date-fns` are still used at runtime; remove only if repository-wide import scans and full CI confirm they are unused.
2. Inspect `app.asar` by package and file type, not just total size.
3. Check native packages for safely excludable **wrong-platform** prebuilds/source trees after electron-builder has selected the target architecture. Add platform-specific packaging tests before excluding anything.
4. Evaluate selective electron-vite bundling of pure-JS main-process dependencies one at a time. Measure each change and keep it only if exports, startup, tests and all platform packages remain correct.
5. Treat route-level lazy loading as startup/RAM work rather than installer-size work.
6. Do not attempt UPX, manual Chromium deletion, native-module replacement or other brittle binary tricks.

### Next product priority

The strongest low-bloat product candidate remains **Offline Student Progress Return**: extend existing exported Study Packs so a student can export a small progress file and a teacher can import it without accounts, a server or classroom internet. It reuses the current offline-pack architecture and fits the Lean Core feature-admission rule.
