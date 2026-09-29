import { describe, expect, it } from 'vitest'
import { join } from 'path'
import { makeIco, planFolder, shortcutFileName } from '../shortcutBranding'

describe('makeIco', () => {
  it('writes an icon directory pointing at each PNG', () => {
    const a = Buffer.from('first-png')
    const b = Buffer.from('second')
    const ico = makeIco([
      { size: 256, png: a },
      { size: 16, png: b }
    ])
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(2)
    // First entry: 256 is written as 0.
    expect(ico.readUInt8(6)).toBe(0)
    expect(ico.readUInt16LE(6 + 6)).toBe(32)
    expect(ico.readUInt32LE(6 + 8)).toBe(a.length)
    const firstOffset = ico.readUInt32LE(6 + 12)
    expect(firstOffset).toBe(6 + 16 * 2)
    expect(ico.subarray(firstOffset, firstOffset + a.length).toString()).toBe('first-png')
    // Second entry follows the first image.
    expect(ico.readUInt8(22)).toBe(16)
    const secondOffset = ico.readUInt32LE(22 + 12)
    expect(secondOffset).toBe(firstOffset + a.length)
    expect(ico.subarray(secondOffset).toString()).toBe('second')
  })
})

describe('shortcutFileName', () => {
  it('keeps what Windows allows in a file name', () => {
    expect(shortcutFileName('Riverside Teachers')).toBe('Riverside Teachers.lnk')
    expect(shortcutFileName('Riverside: Teachers / Staff')).toBe('Riverside Teachers Staff.lnk')
    expect(shortcutFileName('Hope Academy...')).toBe('Hope Academy.lnk')
    expect(shortcutFileName('河畔学校')).toBe('河畔学校.lnk')
  })

  it('falls back to EduBoard for a name Windows won’t take', () => {
    expect(shortcutFileName('')).toBe('EduBoard.lnk')
    expect(shortcutFileName('???')).toBe('EduBoard.lnk')
    expect(shortcutFileName('CON')).toBe('EduBoard.lnk')
  })
})

describe('planFolder', () => {
  const folder = join('C:', 'Users', 'amy', 'Desktop')
  const at = (name: string): string => join(folder, name)

  it('renames the installer’s shortcut to the school’s name', () => {
    expect(planFolder(folder, [at('EduBoard.lnk')], 'Riverside.lnk', false)).toEqual([
      { path: at('EduBoard.lnk'), renameTo: at('Riverside.lnk') }
    ])
  })

  it('leaves a shortcut that already has the name', () => {
    expect(planFolder(folder, [at('Riverside.lnk')], 'Riverside.lnk', false)).toEqual([
      { path: at('Riverside.lnk') }
    ])
  })

  it('removes the shortcut an update put back, keeping the renamed one', () => {
    expect(
      planFolder(folder, [at('EduBoard.lnk'), at('Riverside.lnk')], 'Riverside.lnk', false)
    ).toEqual([{ path: at('EduBoard.lnk'), remove: true }, { path: at('Riverside.lnk') }])
  })

  it('names it back to EduBoard when the school name is cleared', () => {
    expect(planFolder(folder, [at('Riverside.lnk')], 'EduBoard.lnk', false)).toEqual([
      { path: at('Riverside.lnk'), renameTo: at('EduBoard.lnk') }
    ])
  })

  it('never renames or removes a pinned shortcut', () => {
    const pins = [at('EduBoard.lnk'), at('EduBoard (2).lnk')]
    expect(planFolder(folder, pins, 'Riverside.lnk', true)).toEqual(pins.map((path) => ({ path })))
  })
})
