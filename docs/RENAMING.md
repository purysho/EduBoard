# Renaming EduBoard: the checklist

EduBoard may be renamed before funding or the first paid schools (see
`NAME_AND_LICENCE.md`). This is how to do it without losing anyone's data or breaking
updates. The app is already prepared:

- **Updates are found by the kind of file**, not the product's name: `…-Setup.exe`,
  `…-Portable.exe`, `…-arm64.dmg`, `…-x64.dmg`, `….AppImage`
  (`src/main/services/selfUpdateCore.ts`). Copies installed today will update straight
  to a renamed release, so no bridge release is needed.
- **Teachers' data stays in a folder called `EduBoard`** whatever the product is called
  (`DATA_FOLDER_NAME` in `src/shared/branding.ts`, set in `src/main/index.ts`).

## Before renaming

1. The new name's trademark is filed in China (classes 9, 41 and 42), plus Hong Kong or
   any other target market.
2. The new domains are bought and pointed at the Portal server (A records, like
   edu-board.com).

## What changes

| Where | What |
| --- | --- |
| `electron-builder.yml` | `productName` (installer, program and shortcut names) |
| `src/shared/branding.ts` | `PRODUCT_NAME` |
| App text, English and Chinese | `EduBoard` in `tr('…')` strings and `src/shared/i18n/zh/*.ts`. Replace with a script, then read the diff: some sentences may read better reworded |
| Portal | `portal/public/*.html`, `i18n.js`, legal pages (privacy, terms, data processing, security), emails (`portal/services/digest.js`) |
| Homepage downloads | File names in `portal/public/download.html` and the README's download links |
| Workflows | File names in `.github/workflows/test-build.yml` and `release.yml` |
| GitHub | Rename the repository (GitHub redirects the old address). Then update `REPO` in `selfUpdateCore.ts` and `APP_RELEASE_API` in `portal/routes/appRelease.js` |
| Docs | README, `docs/*.md`, CHANGELOG entry explaining the rename |
| Domain | Add the new domain to `HOMEPAGE_HOSTS` and the Caddyfile (`Set-Up-Homepage.cmd` with `HOMEPAGE_DOMAIN=…`). Keep edu-board.com and portal.edu-board.com working, since families and teachers have them saved |

## What never changes

These are invisible to teachers and families. Changing them would lose data, break saved
files, or create a second copy of the app:

| Thing | Value | Why |
| --- | --- | --- |
| Windows app ID | `com.eduboard.app` (`electron-builder.yml`, `src/main/index.ts`) | The installer upgrades the existing install instead of adding a second app |
| Data folder | `EduBoard` (`DATA_FOLDER_NAME`), and `EduBoard-data` next to the portable program | Teachers' classes, backups and settings |
| Database file | `eduboard.db` | Same |
| School pack format | `kind: "eduboard-school-pack"`, files ending `.eduboard-school.json` | Packs schools already have keep importing (a new extension can be added alongside) |
| School pack for a whole computer | `%ProgramData%\EduBoard\school-pack.json` and the Mac/Linux equivalents | Schools' IT has put files there (a new folder can be read as well) |
| Error codes | `EB-xxxx`, `PT-xxxx` | Error reports, docs and support history refer to them |
| Browser storage keys | `eduboard-…` | Families' saved language and settings on the Portal |

## After renaming

1. Release it as a new version, with a line in the release notes: "EduBoard is now
   called …; nothing else changes."
2. Check that an installed copy of the previous version updates itself to the renamed one
   on Windows (installer and portable), Mac and Linux, and opens with its classes.
3. Update the brochure pictures (`portal/public/brochure/`), the demo video, and the
   Portal demo's sample data.
