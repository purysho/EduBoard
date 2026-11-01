// The pilot summary a teacher can save and send by hand at the end of a pilot (Settings →
// What leaves this computer → Pilot summary). It holds counts only, as rough bands, and
// a few facts about the copy: never a name, a grade, a date of birth or anything anyone
// wrote. The teacher sees exactly this before saving, and nothing is sent anywhere.
import { classBand, studentBand, type UsagePing } from './usagePing'

/** How much a feature was used: how many things were made with it, as a band. */
export type UseBand = 'none' | '1-9' | '10-49' | '50+'

export const usageBand = (n: number): UseBand =>
  n <= 0 ? 'none' : n <= 9 ? '1-9' : n <= 49 ? '10-49' : '50+'

/** Days the app was used, as a band (the exact days aren't included). */
export type DaysBand = '0' | '1-4' | '5-14' | '15-29' | '30+'

export const daysBand = (n: number): DaysBand =>
  n <= 0 ? '0' : n <= 4 ? '1-4' : n <= 14 ? '5-14' : n <= 29 ? '15-29' : '30+'

/** The features counted, each by the table its records live in. Only how many rows
 * there are is read, never what's in them. */
export const PILOT_SUMMARY_FEATURES = [
  { id: 'attendance', label: 'Attendance', table: 'attendance_records' },
  { id: 'gradebook', label: 'Gradebook scores', table: 'scores' },
  { id: 'assessments', label: 'Assessments', table: 'assessments' },
  { id: 'lessonPlans', label: 'Lesson plans', table: 'lesson_plans' },
  { id: 'homework', label: 'Homework', table: 'homework_assignments' },
  { id: 'classPoints', label: 'Class points', table: 'behaviour_points' },
  { id: 'reportComments', label: 'Report card comments', table: 'report_comments' },
  { id: 'seating', label: 'Seating plans', table: 'seat_assignments' },
  { id: 'timetable', label: 'Timetable', table: 'class_schedule_slots' },
  { id: 'exitTickets', label: 'Exit tickets', table: 'exit_tickets' },
  { id: 'studentLog', label: 'Student log', table: 'student_log_entries' },
  { id: 'rubrics', label: 'Rubric marking', table: 'rubric_scores' },
  { id: 'resources', label: 'Lesson resources', table: 'lesson_resources' }
] as const

export type PilotSummaryFeature = (typeof PILOT_SUMMARY_FEATURES)[number]['id']

export interface PilotSummary {
  kind: 'eduboard-pilot-summary'
  formatVersion: 1
  /** The day it was made (YYYY-MM-DD), no time. */
  madeOn: string
  appVersion: string
  os: UsagePing['os']
  language: UsagePing['language']
  pilotMode: boolean
  /** Made in the sample school (made-up classes), not the teacher's own. */
  sampleSchool: boolean
  /** Whether the classes are protected with a password. */
  passwordProtected: boolean
  classes: UsagePing['classes']
  students: UsagePing['students']
  daysActive: DaysBand
  features: Record<PilotSummaryFeature, UseBand>
}

export interface PilotSummaryInput {
  madeOn: Date
  appVersion: string
  os: UsagePing['os']
  language: UsagePing['language']
  pilotMode: boolean
  sampleSchool: boolean
  passwordProtected: boolean
  classCount: number
  studentCount: number
  /** How many different days something was recorded. */
  activeDays: number
  /** Row counts by table name (see PILOT_SUMMARY_FEATURES). */
  rowCounts: Readonly<Record<string, number>>
}

/** Builds the summary from counts alone, so nothing else can find its way in. */
export function buildPilotSummary(input: PilotSummaryInput): PilotSummary {
  const features = {} as Record<PilotSummaryFeature, UseBand>
  for (const f of PILOT_SUMMARY_FEATURES) features[f.id] = usageBand(input.rowCounts[f.table] ?? 0)
  return {
    kind: 'eduboard-pilot-summary',
    formatVersion: 1,
    madeOn: input.madeOn.toISOString().slice(0, 10),
    appVersion: input.appVersion,
    os: input.os,
    language: input.language,
    pilotMode: input.pilotMode,
    sampleSchool: input.sampleSchool,
    passwordProtected: input.passwordProtected,
    classes: classBand(input.classCount),
    students: studentBand(input.studentCount),
    daysActive: daysBand(input.activeDays),
    features
  }
}

/** The labels shown next to each line of the summary, for tr(). */
export const PILOT_SUMMARY_TEXTS: readonly string[] = PILOT_SUMMARY_FEATURES.map((f) => f.label)
