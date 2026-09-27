/* eslint-disable @typescript-eslint/explicit-function-return-type */
// Builds docs/ERROR_CODES.md from the two catalogs (src/shared/errorCodes.ts for the app,
// portal/errorCodes.js for the Portal). Run: npm run error-codes. A test checks the file
// matches, so a new code can't be added without its explanation reaching the doc.
import { createRequire } from 'module'
import { APP_ERROR_CODES } from '../../src/shared/errorCodes.ts'

const require = createRequire(import.meta.url)
const { PORTAL_ERROR_CODES } = require('../../portal/errorCodes.js')

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')

function section(catalog) {
  const areas = new Map()
  for (const [code, info] of Object.entries(catalog)) {
    if (!areas.has(info.area)) areas.set(info.area, [])
    areas.get(info.area).push([code, info])
  }
  const out = []
  for (const [area, rows] of areas) {
    out.push(`### ${area}`, '', '| Code | What happened | What to do |', '| --- | --- | --- |')
    for (const [code, info] of rows)
      out.push(`| ${code} | ${cell(info.meaning)} | ${cell(info.fix)} |`)
    out.push('')
  }
  return out.join('\n')
}

export function buildErrorCodesDoc() {
  return `# EduBoard error codes

Every error message in EduBoard ends with a code, so when someone asks for help the code
says what happened. This page is generated from the code catalogs
(\`src/shared/errorCodes.ts\` and \`portal/errorCodes.js\`); run \`npm run error-codes\`
after changing either.

- **EB-xxxx** codes come from the teacher's desktop app: "Couldn't reach the Portal… (EB-1003)".
- **PT-xxxx** codes come from the Portal (the student and family website): "Not your class
  (PT-3001)". When the desktop app talks to the Portal, a PT code can appear inside an
  EB-1008 message.
- **Unexpected errors** (EB-0900, EB-0901, PT-9900) also show a reference, such as
  "EB-0900 · ref 7KQ2MX". Look it up in:
  - the app's error log: ask the teacher for **Settings → Help → Copy error report**
    (or the file \`logs/errors.log\` beside the database, shown by **Show the log file**);
  - the Portal's server log: \`journalctl -u eduboard-portal | grep 7KQ2MX\`.

## Desktop app (EB)

${section(APP_ERROR_CODES)}
## Portal (PT)

${section(PORTAL_ERROR_CODES)}`
}
