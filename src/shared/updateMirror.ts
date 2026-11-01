// A second place EduBoard can find updates, for computers where GitHub is slow or
// blocked (often the case in mainland China). It carries no student data: EduBoard only
// reads a version list from it, and downloads an installer when the teacher updates.
//
// Empty until a mirror is set up. When set, it must be an https address of a folder
// holding the installers from a release and a `latest.json` beside them:
//
//   {
//     "version": "0.8.1",
//     "assets": [
//       { "name": "EduBoard-Setup.exe", "size": 150411188, "sha256": "<64 hex digits>" },
//       ...
//     ]
//   }
//
// Each installer is downloaded from <mirror>/<name> and used only if its SHA-256 matches
// the one listed (the same check as for GitHub). The checksums are in each release's
// SHA256SUMS-*.txt files. docs/DATA_FLOWS.md describes this for school IT.
export const UPDATE_MIRROR_URL = ''

/** How long to wait for GitHub before trying the mirror, when there is one. */
export const GITHUB_TIMEOUT_WITH_MIRROR_MS = 6_000
