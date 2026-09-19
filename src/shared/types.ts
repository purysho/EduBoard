// Shared domain types used by both the main (Node/Electron) process and the renderer (React) UI.
// Keep these framework-agnostic — no Electron or DOM types here.

export type LevelType = 'k12' | 'university' | 'club' | 'other'

export type EnrollmentStatus = 'active' | 'dropped' | 'completed'

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

export type LessonPlanStatus = 'planned' | 'taught' | 'skipped'

export interface GradeThresholds {
  A: number
  B: number
  C: number
  D: number
}

export const DEFAULT_GRADE_THRESHOLDS: GradeThresholds = { A: 90, B: 80, C: 70, D: 60 }

export interface Term {
  id: string
  name: string
  schoolYear: string
  startDate: string | null
  endDate: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Student {
  id: string
  firstName: string
  lastName: string
  preferredName: string | null
  studentNumber: string | null
  dateOfBirth: string | null
  gradeLevel: string | null
  guardianName: string | null
  guardianContact: string | null
  email: string | null
  notes: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface ClassSection {
  id: string
  name: string
  subject: string | null
  levelType: LevelType
  gradeLevel: string | null
  termId: string | null
  schedule: string | null
  room: string | null
  color: string | null
  passMark: number
  maxScore: number
  gradeThresholds: GradeThresholds
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface GradeCategory {
  id: string
  classId: string
  name: string
  weightPercent: number
  sortOrder: number
  createdAt: string
}

export interface Enrollment {
  id: string
  studentId: string
  classId: string
  enrolledOn: string
  status: EnrollmentStatus
  createdAt: string
}

export interface Assessment {
  id: string
  classId: string
  categoryId: string | null
  rubricId: string | null
  name: string
  description: string | null
  assessmentDate: string | null
  maxScore: number
  isFinal: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface AssignmentSubmission {
  id: string
  assessmentId: string
  studentId: string
  filePath: string
  fileName: string
  submittedAt: string
}

export interface Score {
  id: string
  assessmentId: string
  studentId: string
  pointsEarned: number | null
  excused: boolean
  late: boolean
  comment: string | null
  updatedAt: string
}

export interface ScoreHistoryEntry {
  id: string
  scoreId: string
  assessmentId: string
  studentId: string
  previousPoints: number | null
  newPoints: number | null
  previousExcused: boolean
  newExcused: boolean
  changedAt: string
}

export interface Standard {
  id: string
  code: string
  description: string
  subject: string | null
  createdAt: string
}

export interface Rubric {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface RubricCriterion {
  id: string
  rubricId: string
  standardId: string | null
  name: string
  description: string | null
  sortOrder: number
  createdAt: string
}

export interface RubricLevel {
  id: string
  criterionId: string
  label: string
  points: number
  description: string | null
  sortOrder: number
}

/** A criterion with its performance levels attached — the shape the rubric builder
 * and rubric-scoring UI both work with, rather than three flat lists. */
export interface RubricCriterionWithLevels extends RubricCriterion {
  levels: RubricLevel[]
}

/** A full rubric ready to render/score — the library list only needs `Rubric`, but
 * the builder and the scoring modal need the whole tree. */
export interface RubricWithCriteria extends Rubric {
  criteria: RubricCriterionWithLevels[]
  maxPoints: number
}

export interface RubricScore {
  id: string
  assessmentId: string
  studentId: string
  criterionId: string
  levelId: string
  updatedAt: string
}

export const STUDENT_LOG_TYPES = ['note', 'positive', 'concern', 'contact'] as const
export type StudentLogType = (typeof STUDENT_LOG_TYPES)[number]

export const CONTACT_METHODS = ['phone', 'email', 'in-person', 'other'] as const
export type ContactMethod = (typeof CONTACT_METHODS)[number]

export interface StudentLogEntry {
  id: string
  studentId: string
  type: StudentLogType
  text: string
  // Only meaningful when type === 'contact' — a parent-communication entry.
  contactMethod: ContactMethod | null
  followUpNeeded: boolean
  followUpDone: boolean
  createdAt: string
}

export interface ParentCommunicationEntry extends StudentLogEntry {
  studentName: string
}

export const LESSON_RESOURCE_TYPES = ['link', 'file', 'note'] as const
export type LessonResourceType = (typeof LESSON_RESOURCE_TYPES)[number]

export interface LessonResource {
  id: string
  title: string
  type: LessonResourceType
  url: string | null
  filePath: string | null
  notes: string | null
  tags: string[]
  standardId: string | null
  createdAt: string
  updatedAt: string
}

export const EXIT_TICKET_QUESTION_TYPES = ['text', 'choice'] as const
export type ExitTicketQuestionType = (typeof EXIT_TICKET_QUESTION_TYPES)[number]

export interface ExitTicketQuestion {
  id: string
  prompt: string
  type: ExitTicketQuestionType
  options?: string[]
}

export interface ExitTicket {
  id: string
  classId: string
  title: string
  questions: ExitTicketQuestion[]
  isOpen: boolean
  createdAt: string
  updatedAt: string
}

export interface ExitTicketResponse {
  id: string
  exitTicketId: string
  studentName: string
  answers: Record<string, string>
  submittedAt: string
}

export interface ExitTicketServerInfo {
  running: boolean
  url: string | null
  port: number | null
  lanIp: string | null
}

export interface AttendanceRecord {
  id: string
  classId: string
  studentId: string
  date: string
  status: AttendanceStatus
  note: string | null
  createdAt: string
}

export interface LessonPlan {
  id: string
  classId: string
  date: string
  weekLabel: string | null
  title: string
  objectives: string | null
  framework: string | null
  materials: string | null
  activities: string | null
  homework: string | null
  linkedAssessmentId: string | null
  standards: string | null
  status: LessonPlanStatus
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  teacherName: string
  schoolName: string
  theme: 'light' | 'dark' | 'system'
  defaultGradeThresholds: GradeThresholds
  defaultPassMark: number
  defaultMaxScore: number
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  teacherName: '',
  schoolName: '',
  theme: 'system',
  defaultGradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  defaultPassMark: 60,
  defaultMaxScore: 100
}

// --- Derived / computed shapes returned by report & aggregate IPC calls -------------------

export interface StudentClassGrade {
  studentId: string
  classId: string
  percent: number | null
  letter: string | null
  categoryBreakdown: { categoryId: string | null; categoryName: string; percent: number | null }[]
}

export interface ClassRosterRow {
  student: Student
  enrollment: Enrollment
  grade: StudentClassGrade
  attendanceRate: number | null
}

export interface AttendanceSummary {
  studentId: string
  present: number
  late: number
  absent: number
  excused: number
  rate: number | null
}

export interface DashboardStats {
  classCount: number
  studentCount: number
  activeEnrollmentCount: number
  averagePercent: number | null
  passRate: number | null
  averageAttendanceRate: number | null
  upcomingLessons: LessonPlan[]
  ungradedAssessmentCount: number
}

export interface GradeDistributionEntry {
  letter: string
  count: number
  share: number
}

export interface ClassReport {
  classId: string
  averagePercent: number | null
  passRate: number | null
  averageAttendanceRate: number | null
  gradeDistribution: GradeDistributionEntry[]
  categoryAverages: {
    categoryId: string | null
    categoryName: string
    averagePercent: number | null
  }[]
  attendanceTrend: { date: string; rate: number | null }[]
}

export interface DeviceSyncStatus {
  openedOnAnotherDevice: boolean
  previousDeviceLabel?: string
  previousOpenedAt?: string
}

export interface BackupInfo {
  fileName: string
  filePath: string
  sizeBytes: number
  createdAt: string
  automatic: boolean
}

export interface BackupPreview {
  backup: { students: number; classes: number; scores: number; attendanceRecords: number }
  current: { students: number; classes: number; scores: number; attendanceRecords: number }
}
