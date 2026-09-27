// The picking and grouping behind the Classroom tab, kept free of React and random
// sources so they can be tested: pass Math.random in the app, a seeded one in tests.

export type Rng = () => number

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The next name for the random picker. Nobody comes up twice until everyone in the
 * pool has had a turn; then a new round starts (and the last pick can't open it). */
export function pickNext(
  pool: readonly string[],
  alreadyPicked: readonly string[],
  rng: Rng = Math.random
): { pick: string | null; picked: string[]; newRound: boolean } {
  if (!pool.length) return { pick: null, picked: [], newRound: false }
  const inPool = new Set(pool)
  const picked = alreadyPicked.filter((id) => inPool.has(id))
  let left = pool.filter((id) => !picked.includes(id))
  let newRound = false
  let last: string | undefined
  if (!left.length) {
    newRound = true
    last = picked[picked.length - 1]
    left = pool.length > 1 ? pool.filter((id) => id !== last) : [...pool]
  }
  const pick = left[Math.floor(rng() * left.length)]
  return { pick, picked: newRound ? [pick] : [...picked, pick], newRound }
}

/** Splits students into groups, either `size` to a group or `count` groups, as evenly
 * as possible (sizes never differ by more than one). */
export function makeGroups<T>(
  students: readonly T[],
  by: { size: number } | { count: number },
  rng: Rng = Math.random
): T[][] {
  if (!students.length) return []
  const count =
    'count' in by
      ? Math.max(1, Math.min(by.count, students.length))
      : Math.max(1, Math.round(students.length / Math.max(1, by.size)))
  const groups: T[][] = Array.from({ length: count }, () => [])
  shuffle(students, rng).forEach((s, i) => groups[i % count].push(s))
  return groups
}

/** Monday 00:00 (local time) of the week `now` falls in, as an ISO string: where the
 * behaviour points "this week" total starts. */
export function startOfWeekIso(now: Date = new Date()): string {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString()
}
