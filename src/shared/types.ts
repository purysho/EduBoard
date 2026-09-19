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
  name: string
  description: string | null
  assessmentDate: string | null
  maxScore: number
  isFinal: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
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

export interface BackupInfo {
  fileName: string
  filePath: string
  sizeBytes: number
  createdAt: string
}
