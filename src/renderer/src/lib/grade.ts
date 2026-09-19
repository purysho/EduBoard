export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary'

export function letterTone(letter: string | null): Tone {
  if (!letter) return 'neutral'
  if (letter === 'A' || letter === 'B') return 'success'
  if (letter === 'C') return 'warning'
  return 'danger'
}
