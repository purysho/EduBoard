import type { GradeThresholds } from '@shared/types'
import { bandTone } from '@shared/gradeScales'

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary'

/** Badge colour for a letter. With the class's thresholds, any scale's bands are
 * coloured by position; without them, EduBoard's own A–F letters are recognised. */
export function letterTone(letter: string | null, thresholds?: GradeThresholds): Tone {
  if (!letter) return 'neutral'
  if (thresholds) return bandTone(letter, thresholds) ?? 'neutral'
  if (letter === 'A' || letter === 'B') return 'success'
  if (letter === 'C') return 'warning'
  if (letter === 'D' || letter === 'F') return 'danger'
  return 'neutral'
}
