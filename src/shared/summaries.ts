// Shapes shared between the main process and the screens for the teacher's weekly
// summary and the newsletter's fact gathering.
import type { WatchListEntry } from './types'

export interface WeeklySummaryClass {
  classId: string
  name: string
  students: number
  averagePercent: number | null
  passRate: number | null
  attendanceRate: number | null
  taught: string[]
  comingUp: string[]
  dueSoon: { title: string; dueDate: string }[]
  notHandedIn: { title: string; missing: number; of: number }[]
}

export interface WeeklySummary {
  weekOf: string
  classes: WeeklySummaryClass[]
  watchList: WatchListEntry[]
  followUpsDue: number
}

export interface NewsletterSourceChoice {
  classIds: string[]
  lessons: boolean
  upcoming: boolean
  homework: boolean
  posts: boolean
  /** Class averages and attendance: class-level only, never a single student's. */
  numbers: boolean
}
