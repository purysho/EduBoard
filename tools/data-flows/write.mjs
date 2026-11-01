import { writeFileSync } from 'fs'
import { buildDataFlowsDoc } from './build.mjs'

writeFileSync(new URL('../../docs/DATA_FLOWS.md', import.meta.url), buildDataFlowsDoc())
console.log('docs/DATA_FLOWS.md updated')
