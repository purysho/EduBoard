import { writeFileSync } from 'fs'
import { buildErrorCodesDoc } from './build.mjs'

writeFileSync(new URL('../../docs/ERROR_CODES.md', import.meta.url), buildErrorCodesDoc())
console.log('docs/ERROR_CODES.md updated')
