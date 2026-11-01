import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { DATA_FLOWS, PILOT_BLOCKED_CHANNELS } from '../dataFlows'
import { IpcChannels } from '../ipc'
import { buildDataFlowsDoc } from '../../../tools/data-flows/build.mjs'

const ROOT = join(__dirname, '../../..')
const allChannels = new Set(
  Object.values(IpcChannels).flatMap((area) => Object.values(area as Record<string, string>))
)

describe('the list of what leaves this computer', () => {
  it('names only IPC channels that exist', () => {
    const unknown = DATA_FLOWS.flatMap((f) => f.channels).filter((c) => !allChannels.has(c))
    expect(unknown).toEqual([])
  })

  it('gives each channel to one flow at most', () => {
    const channels = DATA_FLOWS.flatMap((f) => f.channels)
    expect(channels.length).toBe(new Set(channels).size)
    expect(PILOT_BLOCKED_CHANNELS.size).toBe(
      DATA_FLOWS.filter((f) => f.pilot === 'blocked').flatMap((f) => f.channels).length
    )
  })

  it('points at code files that exist', () => {
    for (const f of DATA_FLOWS) {
      for (const file of f.code) expect(() => readFileSync(join(ROOT, file)), file).not.toThrow()
    }
  })

  it('has docs/DATA_FLOWS.md up to date (npm run data-flows)', () => {
    expect(readFileSync(join(ROOT, 'docs/DATA_FLOWS.md'), 'utf8')).toBe(buildDataFlowsDoc())
  })
})
