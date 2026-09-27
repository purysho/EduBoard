// Who to check on this month: the reasons a student stands out in a class, from facts
// the teacher already has. Kept to a few plain signals so each one can be acted on.

export const DECLINE_POINTS = 8
export const CONCERNS_TO_FLAG = 3

export interface WatchFacts {
  percent: number | null
  passMark: number
  /** Percents of the student's scored assessments, oldest first. */
  trend: number[]
  /** Concern entries in the student's log over the last 30 days. */
  recentConcerns: number
}

export function watchReasons(f: WatchFacts): string[] {
  const reasons: string[] = []
  if (f.percent !== null && f.percent < f.passMark) {
    reasons.push(`Below the pass mark (${Math.round(f.percent)}% vs ${f.passMark}%)`)
  }
  if (f.trend.length >= 3) {
    const drop = f.trend[0] - f.trend[f.trend.length - 1]
    if (drop >= DECLINE_POINTS) reasons.push(`Grades down ${Math.round(drop)} points`)
  }
  if (f.recentConcerns >= CONCERNS_TO_FLAG) {
    reasons.push(`${f.recentConcerns} concerns logged in 30 days`)
  }
  return reasons
}
