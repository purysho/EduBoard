const CJK = /[㐀-鿿豈-﫿]/

const normalize = (s: string | null | undefined): string =>
  String(s ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

/** Ways of writing one name that should count as the same person: the same parts in
 * either order (Chinese students often put the family name first, so "Chen Mai" is
 * "Mai Chen"), and for Chinese characters, with or without spaces ("陈 麦" is "陈麦").
 * The Portal's join links use the same rules (portal/routes/invites.js). */
export function nameKeys(first: string, last: string): string[] {
  const parts = normalize(`${first} ${last}`).split(' ').filter(Boolean)
  const keys = [[...parts].sort().join(' ')]
  const joined = parts.join('')
  if (CJK.test(joined)) keys.push(`cjk:${joined}`, `cjk:${[...parts].reverse().join('')}`)
  return keys
}

export function sameName(
  a: { firstName: string; lastName: string },
  b: { firstName: string; lastName: string }
): boolean {
  const keys = nameKeys(a.firstName, a.lastName)
  return nameKeys(b.firstName, b.lastName).some((k) => keys.includes(k))
}

/** Pairs of students who look like the same person (same name, allowing for order).
 * Each pair is listed once, older record first. */
export function findPossibleDuplicates<
  T extends { id: string; firstName: string; lastName: string; createdAt: string }
>(students: T[]): [T, T][] {
  const byKey = new Map<string, T[]>()
  for (const s of students) {
    for (const key of nameKeys(s.firstName, s.lastName)) {
      const list = byKey.get(key) ?? []
      if (!list.includes(s)) list.push(s)
      byKey.set(key, list)
    }
  }
  const seen = new Set<string>()
  const pairs: [T, T][] = []
  for (const group of byKey.values()) {
    const sorted = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const id = `${sorted[i].id}|${sorted[j].id}`
        if (seen.has(id)) continue
        seen.add(id)
        pairs.push([sorted[i], sorted[j]])
      }
    }
  }
  return pairs
}
