import { describe, expect, it } from 'vitest'
import { ftsQuery, indexTerms } from '../searchText'

describe('search terms', () => {
  it('indexes each Chinese character on its own and leaves English words alone', () => {
    expect(indexTerms('BMS保护电池')).toBe('BMS 保  护  电  池 ')
  })

  it('searches Chinese by neighbouring character pairs and English by word', () => {
    expect(ftsQuery('什么是BMS？')).toBe('"BMS" OR "什 么" OR "么 是"')
    expect(ftsQuery('Ohm’s law, again')).toBe('"Ohm" OR "s" OR "law" OR "again"')
    expect(ftsQuery('电')).toBe('"电"')
  })

  it('never lets punctuation or quotes through, and has nothing to search for in none', () => {
    expect(ftsQuery('"; DROP TABLE --')).toBe('"DROP" OR "TABLE"')
    expect(ftsQuery('?? !!')).toBe('')
  })
})
