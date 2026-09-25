import { describe, expect, it } from 'vitest'
import { aiUsageReasons, OVERLAP_FLAG_RATIO } from '../aiUsage'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('aiUsageReasons', () => {
  it('is empty when there is no sign of AI', () => {
    expect(aiUsageReasons({ aiDeclared: false, aiHelpCount: 0, aiOverlap: null })).toEqual([])
    expect(aiUsageReasons({ aiDeclared: false, aiHelpCount: 0, aiOverlap: 0.1 })).toEqual([])
  })

  it('explains each reason in plain words', () => {
    expect(aiUsageReasons({ aiDeclared: true, aiHelpCount: 3, aiOverlap: 0.46 })).toEqual([
      'Asked the AI about this assignment 3 times',
      'About 46% of the typed answer matches AI answers they were given',
      'Said they used AI (this can include tools outside the Portal)'
    ])
    expect(aiUsageReasons({ aiDeclared: false, aiHelpCount: 1, aiOverlap: null })[0]).toMatch(
      /once$/
    )
  })

  it('uses the same threshold as the Portal', () => {
    const portal = readFileSync(join(__dirname, '../../../portal/services/aiUsage.js'), 'utf8')
    expect(portal).toContain(`const OVERLAP_FLAG_RATIO = ${OVERLAP_FLAG_RATIO}`)
  })
})
