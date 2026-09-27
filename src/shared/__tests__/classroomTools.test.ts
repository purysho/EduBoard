import { describe, expect, it } from 'vitest'
import { makeGroups, pickNext, shuffle, startOfWeekIso } from '../classroomTools'

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('random picker', () => {
  it('picks everyone once before anyone twice', () => {
    const pool = ['a', 'b', 'c', 'd', 'e']
    const rng = seeded(1)
    let picked: string[] = []
    const seen: string[] = []
    for (let i = 0; i < pool.length; i++) {
      const r = pickNext(pool, picked, rng)
      seen.push(r.pick!)
      picked = r.picked
      expect(r.newRound).toBe(false)
    }
    expect([...seen].sort()).toEqual(pool)
    const next = pickNext(pool, picked, rng)
    expect(next.newRound).toBe(true)
    expect(next.pick).not.toBe(seen[seen.length - 1])
    expect(next.picked).toEqual([next.pick])
  })

  it('forgets picks of students no longer in the pool (absent today)', () => {
    const r = pickNext(['a', 'b'], ['a', 'z'], seeded(2))
    expect(r.pick).toBe('b')
    expect(r.picked).toEqual(['a', 'b'])
  })

  it('copes with one student or none', () => {
    expect(pickNext(['solo'], ['solo'], seeded(3)).pick).toBe('solo')
    expect(pickNext([], [], seeded(3)).pick).toBeNull()
  })
})

describe('group maker', () => {
  const names = Array.from({ length: 23 }, (_, i) => `s${i}`)

  it('makes groups of about the requested size, differing by at most one', () => {
    const groups = makeGroups(names, { size: 4 }, seeded(4))
    const sizes = groups.map((g) => g.length)
    expect(groups).toHaveLength(6)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    expect(groups.flat().sort()).toEqual([...names].sort())
  })

  it('makes the requested number of groups, never more than there are students', () => {
    expect(makeGroups(names, { count: 5 }, seeded(5))).toHaveLength(5)
    expect(makeGroups(['a', 'b'], { count: 5 }, seeded(5))).toHaveLength(2)
    expect(makeGroups([], { count: 3 })).toEqual([])
  })

  it('shuffles without losing or duplicating anyone', () => {
    expect(shuffle(names, seeded(6)).sort()).toEqual([...names].sort())
  })
})

describe('week start', () => {
  it('is the Monday of the same week, at midnight', () => {
    const monday = new Date(startOfWeekIso(new Date(2026, 8, 27, 15, 30))) // Sunday
    expect(monday.getDay()).toBe(1)
    expect(monday.getDate()).toBe(21)
    expect(monday.getHours()).toBe(0)
    expect(new Date(startOfWeekIso(new Date(2026, 8, 21, 8))).getDate()).toBe(21) // Monday
  })
})
