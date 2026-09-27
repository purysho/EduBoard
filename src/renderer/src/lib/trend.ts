import type { GradeTrendDirection, GradeTrendPoint } from '@shared/types'

const TREND_THRESHOLD_POINTS = 8

/** Improving / declining / steady from the first to the latest scored assessment (at
 * least three), with the change in points. */
export function classifyTrend(
  trend: GradeTrendPoint[] | undefined
): { direction: GradeTrendDirection; deltaPoints: number } | null {
  if (!trend || trend.length < 3) return null
  const delta = trend[trend.length - 1].percent - trend[0].percent
  if (delta >= TREND_THRESHOLD_POINTS) return { direction: 'improving', deltaPoints: delta }
  if (delta <= -TREND_THRESHOLD_POINTS) return { direction: 'declining', deltaPoints: delta }
  return { direction: 'steady', deltaPoints: delta }
}
