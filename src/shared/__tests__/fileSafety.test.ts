import { describe, expect, it } from 'vitest'
import { checkUpload } from '../fileSafety'
import cases from './fileSafetyCases.json'

describe('checkUpload', () => {
  for (const c of cases.cases) {
    it(`${c.ok ? 'accepts' : 'rejects'} ${c.name}`, () => {
      const result = checkUpload(c.fileName, new Uint8Array(Buffer.from(c.base64, 'base64')))
      expect(result.ok).toBe(c.ok)
    })
  }
})
