// Shared domain types used by both the main (Node/Electron) process and the renderer (React) UI.
// Keep these framework-agnostic — no Electron or DOM types here.
import type { Flashcard, PracticeQuestion } from './practiceSets'

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

export interface CourseGroup {
  id: string
  name: string
  createdAt: string
}

export interface ClassSection {
  id: string
  name: string
  subject: string | null
  levelType: LevelType
  gradeLevel: string | null
  termId: string | null
  /** Groups this class together with the same course's sections in other terms — the
   * basis for a multi-term composite grade. Null means it isn't part of one. */
  courseGroupId: string | null
  /** How much this class's grade counts toward the course group's composite, relative
   * to the group's other classes (default 1 — every term counts equally). */
  termWeight: number
  schedule: string | null
  room: string | null
  color: string | null
  passMark: number
  maxScore: number
  seatingRows: number
  seatingCols: number
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

export interface SeatAssignment {
  id: string
  classId: string
  studentId: string
  row: number
  col: number
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

export const HOMEWORK_QUESTION_TYPES = ['multiple_choice', 'short_answer'] as const
export type HomeworkQuestionType = (typeof HOMEWORK_QUESTION_TYPES)[number]

/** A lightweight auto-graded formative-check question attached to an assignment —
 * graded automatically by the Portal the moment a student submits, no teacher review
 * needed (see portal/routes/me.js). `options` only applies to multiple_choice. */
export interface HomeworkQuestion {
  id: string
  homeworkAssignmentId: string
  type: HomeworkQuestionType
  prompt: string
  options: string[] | null
  correctAnswer: string
  points: number
  sortOrder: number
}

/** A rubric score against a homework submission rather than an assessment — a separate
 * shape/table from RubricScore so the existing assessment-grading path needs no changes;
 * see homeworkRubricScores.ts. */
export interface HomeworkRubricScore {
  id: string
  homeworkAssignmentId: string
  studentId: string
  criterionId: string
  levelId: string
  updatedAt: string
}

export const STUDENT_LOG_TYPES = ['note', 'positive', 'concern', 'contact'] as const
export type StudentLogType = (typeof STUDENT_LOG_TYPES)[number]

export const CONTACT_METHODS = ['phone', 'email', 'in-person', 'other'] as const
export type ContactMethod = (typeof CONTACT_METHODS)[number]

export const AUDIT_LOG_ACTIONS = ['create', 'update', 'delete'] as const
export type AuditLogAction = (typeof AUDIT_LOG_ACTIONS)[number]

/** One entry in the app-wide activity trail — who changed what, when. studentId/classId
 * are set whenever the action concerns one (most do), which is what lets a student's
 * whole trail disappear from view the moment they're removed (see deleteStudent) without
 * actually being deleted from the database for another 12 months. */
export interface AuditLogEntry {
  id: string
  entityType: string
  entityId: string
  action: AuditLogAction
  summary: string
  studentId: string | null
  classId: string | null
  createdAt: string
}

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
  /** When this resource's text was last extracted and indexed for Notebook search —
   * null means never indexed. Set by notebookService.indexResource(), never by the
   * ordinary create/update form. */
  indexedAt: string | null
  /** Opts this resource into a class's Portal materials — null classId means "personal
   * library only," never pushed to students regardless of shareWithStudents. */
  classId: string | null
  shareWithStudents: boolean
  /** An AI-generated summary of this resource, shown to students alongside the source
   * material and read aloud via the browser's TTS — see aiService.draftStudyGuide. */
  studyGuide: string | null
  /** AI-drafted self-study sets published with the resource (see practiceSets.ts). Set
   * only through notebookService.draftPracticeSet, never by the edit form. */
  flashcards: Flashcard[] | null
  practiceQuiz: PracticeQuestion[] | null
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

/** 0 = Sunday, matching JS Date#getDay() — kept structured (vs. the free-text
 * ClassSection.schedule field) so a Timetable view can group/sort by day and time. */
export interface ClassScheduleSlot {
  id: string
  classId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  room: string | null
  createdAt: string
}

/** A schedule slot with its class's name/color attached — what the Timetable page's
 * weekly grid renders, so it doesn't need a separate class lookup per slot. */
export interface ClassScheduleSlotWithClass extends ClassScheduleSlot {
  className: string
  classColor: string | null
}

export const HOMEWORK_SUBMISSION_STATUSES = ['not_started', 'submitted', 'done'] as const
export type HomeworkSubmissionStatus = (typeof HOMEWORK_SUBMISSION_STATUSES)[number]

/** Due-dated homework, distinct from a gradebook Assessment — this is what the Portal
 * (once built) shows to university-level students and lets them mark as submitted.
 * Until then, the teacher tracks status manually here. */
export const HOMEWORK_ASSIGNMENT_STATUSES = ['draft', 'published'] as const
export type HomeworkAssignmentStatus = (typeof HOMEWORK_ASSIGNMENT_STATUSES)[number]

export interface HomeworkAssignment {
  id: string
  classId: string
  title: string
  description: string | null
  dueDate: string | null
  filePath: string | null
  fileName: string | null
  topic: string | null
  /** 'draft' assignments exist only in the desktop app — never sent to the Portal, so
   * students never see them. A teacher can build out homework ahead of time and publish
   * it (see HomeworkTab's Publish button) exactly when it should go live. */
  status: HomeworkAssignmentStatus
  /** Optional rubric to grade submissions against — when set, the teacher scores a
   * submission criterion-by-criterion (see HomeworkRubricScore) instead of, or in
   * addition to, freeform grade text. */
  rubricId: string | null
  createdAt: string
  updatedAt: string
}

/** An assignment with its class's name/color attached — what the Calendar view renders,
 * since it shows due dates across every class at once rather than one class at a time. */
export interface HomeworkAssignmentWithClass extends HomeworkAssignment {
  className: string
  classColor: string | null
}

export interface HomeworkSubmission {
  id: string
  homeworkAssignmentId: string
  studentId: string
  status: HomeworkSubmissionStatus
  submittedAt: string | null
  updatedAt: string
  textAnswer: string | null
  fileName: string | null
  grade: string | null
  feedback: string | null
  gradedAt: string | null
  portfolio: boolean
}

/** An AI-proposed grade and comment for one submission. Never saved by itself: it only
 * pre-fills the teacher's grade/feedback boxes. `flags` are notes for the teacher alone
 * (blank work, an unreadable file, text that tried to instruct the grader). */
export interface FeedbackDraft {
  feedback: string
  suggestedGrade: string | null
  flags: string[]
}

/** One row per student for one assignment — what the per-assignment roster view
 * renders, so it doesn't need a separate student lookup per submission. */
export interface HomeworkSubmissionWithStudent extends HomeworkSubmission {
  studentName: string
}

/** One printable strip: a Portal sign-up invite, pre-scoped to a class (and, via the
 * class's levelType/courseGroupId, to whatever that class's students can see) at
 * generation time — see PortalInviteBatch. Not usable until the Portal backend exists;
 * the code and QR are generated now so batches are ready to print and hand out. */
export interface PortalInvite {
  id: string
  batchId: string
  classId: string
  code: string
  revoked: boolean
  claimedAt: string | null
  createdAt: string
}

export interface PortalInviteBatch {
  id: string
  classId: string
  count: number
  createdAt: string
  printedAt: string | null
}

export interface PortalInviteBatchWithInvites extends PortalInviteBatch {
  invites: PortalInvite[]
}

/** A message thread lives entirely on the Portal, not mirrored into the desktop's own
 * database — the desktop fetches it live (like homework attachments), since there's
 * only one teacher and no offline-editing conflict to worry about resolving. */
export interface PortalMessage {
  id: string
  sender: 'family' | 'teacher'
  body: string
  createdAt: string
}

export interface PortalMessageThread {
  accountId: string
  username: string
  studentNames: string | null
  unread: number
  messages: PortalMessage[]
}

/** A Class Story post — lives only on the Portal, same as messages/homework
 * attachments, fetched live rather than mirrored locally. */
export interface ClassPost {
  id: string
  classId: string
  body: string
  hasImage: boolean
  createdAt: string
}

/** A QR check-in session's live state for one class — open/closed, which date it's
 * marking attendance for, and who has checked themselves in so far. Ephemeral
 * (in-memory only, like ExitTicketServerInfo's running server), not persisted. */
export interface AttendanceCheckInStatus {
  open: boolean
  date: string | null
  checkedInStudentIds: string[]
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

export const AI_PROVIDERS = ['deepseek', 'qwen', 'zhipu', 'anthropic', 'custom'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export interface AppSettings {
  teacherName: string
  schoolName: string
  theme: 'light' | 'dark' | 'system'
  defaultGradeThresholds: GradeThresholds
  defaultPassMark: number
  defaultMaxScore: number
  /** Which LLM provider the AI drafting features call. 'deepseek' is the default so a
   * teacher in mainland China gets a working feature with no VPN — 'qwen' is another
   * China-reachable option, 'anthropic' is there for anyone who prefers/has it, and
   * 'custom' points at any OpenAI-compatible endpoint (Moonshot, Zhipu, a local Ollama
   * server, OpenAI itself, anything) so a teacher outside this app's original use case
   * isn't stuck with only the presets above. */
  aiProvider: AiProvider
  /** A teacher-supplied API key for whichever provider is selected above, used only
   * for the optional AI lesson-plan and report-comment drafting features — empty
   * means those features are unavailable. Sent straight to that provider's API from
   * the main process; never bundled, never anyone else's key. Ignored for a 'custom'
   * provider pointed at a server that needs no key (e.g. local Ollama). */
  aiApiKey: string
  /** Only used when aiProvider === 'custom' — the OpenAI-compatible chat/completions
   * base URL (e.g. "http://localhost:11434/v1" for Ollama, or another provider's
   * endpoint) and the model name to request. */
  aiCustomBaseUrl: string
  aiCustomModel: string
  /** Base URL of a deployed Portal instance (see portal/README.md) — e.g.
   * "https://portal.example.com". Empty means the Portal features (publish/pull) are
   * unavailable, same "entirely opt-in" shape as everything else here. */
  portalUrl: string
  /** Shared secret the Portal's /api/sync routes require (SYNC_SECRET on the server
   * side) — set once, matching whatever was configured when the Portal was deployed. */
  portalSyncSecret: string
  /** A single shared key the teacher provides so EVERY student can use the Portal's AI
   * features (chat about materials, study guides) — deliberately one key for the whole
   * class rather than per-student keys, the same "teacher provisions, students just use
   * it" shape as portalSyncSecret. Pushed to the Portal on publish; the Portal calls the
   * provider itself, so this key is never sent to a student's browser. 'zhipu' defaults
   * here since GLM-4-Flash has a genuinely free tier and is China-reachable. */
  portalAiProvider: AiProvider
  portalAiApiKey: string
  portalAiCustomBaseUrl: string
  portalAiCustomModel: string
  /** SMTP config for the weekly parent digest email, sent from the Portal server (not
   * the desktop app) — same "teacher provisions once, pushed on every publish" shape as
   * the AI key above. digestEnabled off by default; a Gmail app password + smtp.gmail.com
   * works fine for this volume, but any SMTP provider works. */
  digestEnabled: boolean
  digestSmtpHost: string
  digestSmtpPort: number
  digestSmtpUser: string
  digestSmtpPass: string
  digestFromEmail: string
  digestFromName: string
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  teacherName: '',
  schoolName: '',
  theme: 'system',
  defaultGradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  defaultPassMark: 60,
  defaultMaxScore: 100,
  aiProvider: 'deepseek',
  aiApiKey: '',
  aiCustomBaseUrl: '',
  aiCustomModel: '',
  portalUrl: '',
  portalSyncSecret: '',
  portalAiProvider: 'zhipu',
  portalAiApiKey: '',
  portalAiCustomBaseUrl: '',
  portalAiCustomModel: '',
  digestEnabled: false,
  digestSmtpHost: '',
  digestSmtpPort: 587,
  digestSmtpUser: '',
  digestSmtpPass: '',
  digestFromEmail: '',
  digestFromName: ''
}

// --- Derived / computed shapes returned by report & aggregate IPC calls -------------------

export interface StudentClassGrade {
  studentId: string
  classId: string
  percent: number | null
  letter: string | null
  categoryBreakdown: { categoryId: string | null; categoryName: string; percent: number | null }[]
}

/** One scored assessment on a student's grade trajectory in a class — what the Analytics
 * page's per-student trend chart plots, oldest first. */
export interface GradeTrendPoint {
  assessmentId: string
  assessmentName: string
  date: string | null
  percent: number
}

export interface CompositeGradeClassEntry {
  classId: string
  className: string
  termId: string | null
  termName: string | null
  termWeight: number
  percent: number | null
  letter: string | null
}

export interface StudentCompositeGrade {
  studentId: string
  studentName: string
  classes: CompositeGradeClassEntry[]
  compositePercent: number | null
  compositeLetter: string | null
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

/** One class's headline numbers, for side-by-side comparison across all classes. */
export interface ClassComparisonEntry {
  classId: string
  className: string
  averagePercent: number | null
  passRate: number | null
  averageAttendanceRate: number | null
}

/** One grading category's average, aggregated by category name across every class that
 * has a category of that name — surfaces which kind of work is weakest school-wide. */
export interface CategoryComparisonEntry {
  categoryName: string
  averagePercent: number | null
  classCount: number
}

export interface AnalyticsOverview {
  classComparison: ClassComparisonEntry[]
  categoryComparison: CategoryComparisonEntry[]
  attendanceTrend: { date: string; rate: number | null }[]
}

// --- Notebook (chat with your Resources library, grounded with citations) ----------------

export interface NotebookCitation {
  resourceId: string
  resourceTitle: string
  chunkIndex: number
  snippet: string
}

export interface NotebookAnswer {
  answer: string
  citations: NotebookCitation[]
}

// --- AI drafting (optional, requires a teacher-supplied API key) -------------------------

export interface DraftLessonPlanInput {
  className: string
  subject: string | null
  gradeLevel: string | null
  topic: string
}

export interface DraftedLessonPlan {
  title: string
  objectives: string
  materials: string
  activities: string
  homework: string
}

export type GradeTrendDirection = 'improving' | 'declining' | 'steady'

export interface DraftReportCommentInput {
  studentName: string
  className: string
  percent: number | null
  letter: string | null
  attendanceRate: number | null
  recentNotes: string[]
  trendDirection: GradeTrendDirection | null
  trendDeltaPoints: number | null
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
