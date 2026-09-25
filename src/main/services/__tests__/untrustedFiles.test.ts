import { describe, expect, it } from 'vitest'
import { dirname, resolve } from 'path'
import { isSafeToOpen, safeDownloadPath } from '../untrustedFiles'

const dir = resolve('/tmp/eduboard-submissions')

describe('safeDownloadPath', () => {
  const hostile = [
    '../../evil.txt',
    '..\\..\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\x.bat',
    '/etc/passwd',
    'C:\\Windows\\System32\\drivers\\etc\\hosts',
    '....//....//x',
    '',
    'con:',
    'a'.repeat(500) + '.pdf'
  ]
  for (const name of hostile) {
    it(`keeps ${JSON.stringify(name.slice(0, 40))} inside the downloads folder`, () => {
      const p = safeDownloadPath(dir, 'student1', name)
      expect(dirname(p)).toBe(dir)
      expect(p.length - dir.length).toBeLessThanOrEqual(151)
    })
  }

  it('keeps an ordinary name readable', () => {
    expect(safeDownloadPath(dir, 's1', 'Essay draft 2.docx')).toBe(
      resolve(dir, 's1-Essay draft 2.docx')
    )
  })
})

describe('isSafeToOpen', () => {
  it('opens documents and media directly', () => {
    for (const n of ['essay.PDF', 'notes.docx', 'photo.jpg', 'data.csv']) {
      expect(isSafeToOpen(n)).toBe(true)
    }
  })
  it('never launches anything executable', () => {
    for (const n of [
      'x.exe',
      'x.bat',
      'x.cmd',
      'x.js',
      'x.vbs',
      'x.lnk',
      'x.ps1',
      'x.scr',
      'x.msi',
      'x.jar',
      'x.hta',
      'x.pdf.exe',
      'noextension'
    ]) {
      expect(isSafeToOpen(n)).toBe(false)
    }
  })
})
