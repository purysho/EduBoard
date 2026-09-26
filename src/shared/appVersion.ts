/** True when `latest` is a newer version than `current` (plain x.y.z numbers). */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string): number[] =>
    v
      .replace(/^v/, '')
      .split('-')[0]
      .split('.')
      .map((n) => Number(n) || 0)
  const a = parse(latest)
  const b = parse(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}
