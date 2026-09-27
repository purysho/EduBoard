import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { describe, expect, it } from 'vitest'
import { keysInSource } from '../keys'
import { ZH } from '../zh'
import { DYNAMIC_KEYS } from '../dynamicKeys'
import { setUiLanguage, tr, trn } from '..'

const ROOT = join(__dirname, '../../..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(name) && !path.includes(join('shared', 'i18n')) ? [path] : []
  })
}

describe('Chinese interface text', () => {
  it('has a translation for every string the app shows', () => {
    const missing: string[] = []
    for (const file of sourceFiles(ROOT)) {
      for (const key of keysInSource(readFileSync(file, 'utf8'))) {
        if (!(key in ZH)) missing.push(`${relative(ROOT, file)}: ${key}`)
      }
    }
    for (const key of DYNAMIC_KEYS) if (!(key in ZH)) missing.push(`(dynamic): ${key}`)
    expect(missing).toEqual([])
  })

  it('keeps every {placeholder} of the English in the translation', () => {
    const names = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const wrong = Object.entries(ZH).filter(([en, zh]) => names(en).join() !== names(zh).join())
    expect(wrong).toEqual([])
  })

  it('switches language and fills placeholders', () => {
    setUiLanguage('zh')
    expect(tr('Save')).toBe(ZH.Save)
    expect(tr('Not in the dictionary {n}', { n: 3 })).toBe('Not in the dictionary 3')
    setUiLanguage('en')
    expect(tr('Save')).toBe('Save')
    expect(trn('{n} class', '{n} classes', 1)).toBe('1 class')
    expect(trn('{n} class', '{n} classes', 2)).toBe('2 classes')
  })
})
