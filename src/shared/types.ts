// Shared domain types used by both the main (Node/Electron) process and the renderer (React) UI.
// Keep these framework-agnostic — no Electron or DOM types here.
import {
  DEFAULT_COMMENT_BANK,
  DEFAULT_COMMENT_BANK_ZH,
  defaultCommentBank,
  type BankComment
} from './commentBank'
import {
  DEFAULT_LETTER_TEMPLATE,
  DEFAULT_LETTER_TEMPLATE_ZH,
  defaultLetterTemplate
} from './letters'
import { uiLanguage, type Terminology } from './i18n'
import type { AttendanceCode } from './attendanceCodes'
import type { PointCategory } from './pointCategories'
import type { GroupChat } from './groupChats'
import type { ReportCardLayout, SavedTemplate } from './templates'
import type { Flashcard, PracticeQuestion } from './practiceSets'

export type LevelType = 'k12' | 'university' | 'club' | 'other'

export type EnrollmentStatus = 'active' | 'dropped' | 'completed'

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

/** 'partly': taught, but not enough of the class got it: re-teach before moving on. */
export type LessonPlanStatus = 'planned' | 'taught' | 'partly' | 'skipped'

export interface GradeThresholds {
  A: number
  B: number
  C: number
  D: number
  /** Any scale other than A–F: its bands (see shared/gradeScales.ts). A–D above are
   * then unused but kept, so switching back restores the teacher's old cut-offs. */
  scale?: { label: string; min: number }[]
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
  /** Answers to the teacher's own student fields (Settings → Lists), keyed by field id. */
  customFields?: Record<string, string> | null
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
  /** Attendance requirement in percent (e.g. 80); null means none. */
  minAttendance: number | null
  schedule: string | null
  room: string | null
  color: string | null
  passMark: number
  maxScore: number
  seatingRows: number
  seatingCols: number
  gradeThresholds: GradeThresholds
  /** No homework may be set in this class (some courses don't allow it): lesson plans
   * call their "homework" part in-class consolidation instead. */
  noHomework: boolean
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
  /** When true, a teacher can record retries and the highest attempt becomes the grade. */
  bestAttempt: boolean
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

export interface ScoreAttempt {
  id: string
  assessmentId: string
  studentId: string
  attemptNumber: number
  pointsEarned: number
  createdAt: string
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

export type CompetencyEvidenceSource = 'assessment' | 'homework'

export interface CompetencyMatrixStandard {
  id: string
  code: string
  description: string
}

export interface CompetencyMatrixStudent {
  id: string
  name: string
}

export interface CompetencyEvidenceCell {
  studentId: string
  standardId: string
  /** All rubric levels selected for this standard in the most recent evidence source. */
  latestLevelLabels: string[]
  /** One agreed latest level, or null when the newest evidence is mixed / absent. */
  latestLevelLabel: string | null
  latestEvidenceMixed: boolean
  latestSourceType: CompetencyEvidenceSource | null
  latestSourceName: string | null
  latestAt: string | null
  /** Number of rubric-criterion selections linked to this standard for this student. */
  evidenceCount: number
}

export interface CompetencyMatrix {
  classId: string
  standards: CompetencyMatrixStandard[]
  students: CompetencyMatrixStudent[]
  cells: CompetencyEvidenceCell[]
}

export type CurriculumMapScopeType = 'courseGroup' | 'class'

export interface CurriculumMapSection {
  classId: string
  className: string
  termId: string | null
  termName: string | null
  termSortOrder: number
}

export interface CurriculumMapResource {
  id: string
  title: string
  type: LessonResourceType
}

export interface CurriculumMapAssessmentRef {
  id: string
  classId: string
  className: string
  name: string
  date: string | null
}

export interface CurriculumMapLesson {
  id: string
  classId: string
  className: string
  termId: string | null
  termName: string | null
  date: string
  originalDate: string | null
  moved: boolean
  weekLabel: string | null
  title: string
  status: LessonPlanStatus
  standards: string[]
  assessment: CurriculumMapAssessmentRef | null
  resources: CurriculumMapResource[]
}

export interface CurriculumStandardCoverage {
  code: string
  lessonCount: number
  taughtCount: number
  plannedCount: number
  skippedCount: number
}

export interface CurriculumMap {
  scopeType: CurriculumMapScopeType
  scopeId: string
  name: string
  sections: CurriculumMapSection[]
  lessons: CurriculumMapLesson[]
  unlinkedAssessments: CurriculumMapAssessmentRef[]
  standardCoverage: CurriculumStandardCoverage[]
  nextLessonId: string | null
  summary: {
    total: number
    planned: number
    taught: number
    skipped: number
    moved: number
  }
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
  /** Which of the three AI drafts above the teacher has checked. Students only see an
   * approved one; drafting a new version needs checking again. */
  aiApproved: AiApproval
}

/** The AI-drafted study materials a resource can carry. */
export const AI_MATERIAL_KINDS = ['studyGuide', 'flashcards', 'practiceQuiz'] as const
export type AiMaterialKind = (typeof AI_MATERIAL_KINDS)[number]
export type AiApproval = Partial<Record<AiMaterialKind, boolean>>

export const EXIT_TICKET_QUESTION_TYPES = ['text', 'choice'] as const
export type ExitTicketQuestionType = (typeof EXIT_TICKET_QUESTION_TYPES)[number]

export interface ExitTicketQuestion {
  id: string
  prompt: string
  type: ExitTicketQuestionType
  options?: string[]
  /** For a choice question: the options (by index) that show the student understood. Only
   * the teacher sees this; it drives the "re-teach" suggestion (shared/exitTicketSummary). */
  goodOptions?: number[]
}

export interface ExitTicket {
  id: string
  classId: string
  title: string
  questions: ExitTicketQuestion[]
  isOpen: boolean
  /** When an open session closes itself; null means it stays open until closed. */
  closesAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ExitTicketResponse {
  id: string
  exitTicketId: string
  studentName: string
  /** The roster student who answered; null for responses from before names were picked
   * from the roster, or a student since removed. */
  studentId: string | null
  answers: Record<string, string>
  submittedAt: string
}

export interface ExitTicketServerInfo {
  running: boolean
  url: string | null
  port: number | null
  lanIp: string | null
}

/** One teacher-opened, read-only lesson page served only on the classroom LAN. */
export interface ClassroomHubStatus {
  open: boolean
  lessonId: string | null
  title: string | null
  url: string | null
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
  /** From the Portal: see src/shared/aiUsage.ts. */
  aiDeclared: boolean
  aiHelpCount: number
  aiOverlap: number | null
}

/** What a student chose to share from their Portal profile. Their private notes and
 * full date of birth never leave the Portal; `birthday` is "MM-DD", and only when the
 * student opted to share it. */
export interface PortalStudentProfile {
  studentId: string
  preferredName: string | null
  pronouns: string | null
  bio: string | null
  birthday: string | null
  goals: string | null
  teacherNote: string | null
  preferredLanguage: string | null
  /** The subject or major the student gave the Study Helper (null on an older Portal). */
  fieldOfStudy?: string | null
  /** A data: URL of the student's (Portal-re-encoded) photo, or null. */
  photoDataUrl: string | null
  updatedAt: string
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
/** What one family would get in this week's digest. */
export interface DigestPreview {
  accountId: string
  username: string
  /** Null when the family hasn't given an email yet (they'd get nothing). */
  email: string | null
  students: string[]
  html: string
}

/** The parts of the family digest a teacher can switch off. */
export interface DigestOptions {
  grades: boolean
  attendance: boolean
  homework: boolean
  classStory: boolean
  messages: boolean
  /** This week's class points by category. Off unless the teacher turns it on. */
  points?: boolean
}

export interface ClassPost {
  id: string
  classId: string
  body: string
  hasImage: boolean
  createdAt: string
  /** Read receipts (missing from older Portals): how many students' families
   * have seen the post, out of those with a Portal login, who hasn't, and how many
   * students have no login at all. */
  seenCount?: number
  audience?: number
  notSeen?: string[]
  noLogin?: number
  /** The reply slip (回执), when the post asks for one: families confirm they've read it
   * ('ack') or answer a yes / no question. Missing from older Portals. */
  replyKind?: PostReplyKind
  replyQuestion?: string | null
  replies?: { ack: number; yes: number; no: number }
  answeredYes?: string[]
  answeredNo?: string[]
  /** Students with a Portal login whose family hasn't replied yet. */
  notReplied?: string[]
}

export type PostReplyKind = 'ack' | 'yesno'

/** What a new Class Story post asks families to reply, if anything. */
export interface PostReplySlip {
  kind: PostReplyKind
  question: string | null
}

/** One thing on a student's timeline, from any of their classes. Each kind fills in its
 * own fields; the screen words it. */
export type StudentTimelineKind =
  'enrolled' | 'attendance' | 'score' | 'points' | 'note' | 'homework' | 'comment'

export interface StudentTimelineEvent {
  kind: StudentTimelineKind
  /** The day it happened (YYYY-MM-DD), and a full time for ordering within the day. */
  date: string
  at: string
  classId: string | null
  className: string | null
  /** attendance: the code's label and what it counts as. */
  attendanceLabel?: string
  attendanceCountsAs?: AttendanceStatus
  /** score: the assessment, points out of max, or excused. */
  assessmentName?: string
  pointsEarned?: number | null
  maxScore?: number
  excused?: boolean
  /** points: the day's class points by category. */
  pointItems?: { name: string; total: number }[]
  /** note: the log entry. */
  logType?: StudentLogType
  contactMethod?: ContactMethod | null
  followUpNeeded?: boolean
  followUpDone?: boolean
  /** homework: what was handed in, and its grade. */
  homeworkTitle?: string
  homeworkGrade?: string | null
  /** note, comment, attendance, homework feedback: the words themselves. */
  text?: string | null
}

/** One report card title sent to a class's families on the Portal, and who has
 * opened it. A student's family has seen it once any login linked to them opened it. */
export interface ReportCardDelivery {
  title: string
  sentAt: string
  /** Students it was sent to. */
  sent: number
  /** Of those, students with a Portal login (the others can't see it yet). */
  audience: number
  seenCount: number
  students: { studentId: string; name: string; hasLogin: boolean; seenAt: string | null }[]
}

/** How sending report cards went: how many reached the Portal, and any that didn't. */
export interface ReportCardSendResult {
  sent: number
  failed: { name: string; message: string }[]
}

/** While report cards are being made and sent: how far along it is. */
export interface ReportCardSendProgress {
  done: number
  total: number
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
  /** A built-in status or one of the school's own codes (see attendanceCodes.ts). */
  status: string
  note: string | null
  createdAt: string
}

export type LessonEvidenceValue = '✓' | '1' | '2' | '3' | '4' | '5' | 'M' | 'N'

export interface LessonEvidence {
  id: string
  lessonPlanId: string
  studentId: string
  value: LessonEvidenceValue
  updatedAt: string
}

export interface LessonPlan {
  id: string
  classId: string
  date: string
  /** First scheduled date; null only for legacy rows before the curriculum-map migration. */
  originalDate: string | null
  weekLabel: string | null
  title: string
  objectives: string | null
  framework: string | null
  materials: string | null
  activities: string | null
  /** The same task made easier for students who need it: frames, model language, a
   * shorter text, more time. */
  support: string | null
  /** The same task made harder for those ready: less scaffolding, a counterargument, a
   * more expert audience, less time. */
  stretch: string | null
  homework: string | null
  linkedAssessmentId: string | null
  standards: string | null
  status: LessonPlanStatus
  createdAt: string
  updatedAt: string
}

export const AI_PROVIDERS = ['deepseek', 'qwen', 'zhipu', 'anthropic', 'custom'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

/** What a publish did, for the teacher. */
export interface PublishResult {
  attachmentsUploaded: number
  materialsUploaded: number
  /** Attachments that couldn't be sent, with why, e.g. "Worksheet.pdf (over 25 MB)". */
  skipped: string[]
  /** Set when the Portal server is too old to take attachments separately. */
  outdatedServer: boolean
  /** Students who joined through a class link and were added to this roster. */
  studentsJoined: number
}

/** A Portal join link (see src/main/repositories/portalJoinLinks.ts). */
export interface PortalJoinLink {
  id: string
  classId: string
  studentId: string | null
  kind: 'class_link' | 'student'
  code: string
  revoked: boolean
  createdAt: string
}

/** What the Portal tab shows about a class's join links. */
export interface PortalJoinLinksOverview {
  /** The address links start with, e.g. https://portal.edu-board.com, or '' if unset. */
  portalUrl: string
  classLink: PortalJoinLink | null
  /** Personal links by student id. */
  studentLinks: Record<string, PortalJoinLink>
  /** Students who already have a Portal account, or null if the Portal couldn't be asked. */
  studentsWithAccounts: string[] | null
}

/** One AI provider setup, as entered in Settings (possibly not saved yet). */
export interface AiConnectionConfig {
  provider: AiProvider
  apiKey: string
  customBaseUrl: string
  customModel: string
  /** A different model from a built-in provider (e.g. a stronger or newer one); '' uses
   * the provider's default. The custom provider uses customModel instead. */
  model?: string
}

export type AiConnectionTestResult =
  { ok: true; model: string; reply: string } | { ok: false; error: string }

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
  /** Another model from the chosen provider; '' means its default (AiConnectionConfig). */
  aiModel: string
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
  /** The model the Portal's Study Helper uses; '' means the provider's default. */
  portalAiModel: string
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
  /** The teacher hid the Dashboard's Getting started checklist. */
  onboardingDismissed: boolean
  /** A second place backups are copied to (a cloud-synced folder or USB stick), so a
   * lost or broken computer doesn't take the backups with it. Empty means none. */
  extraBackupFolder: string
  /** Download new versions in the background and install them the next time EduBoard
   * opens. On by default; off means updates only happen from Settings. */
  autoUpdate: boolean
  /** With password protection on: lock after this many minutes with no keyboard or
   * mouse use (0 = only when locked by hand or the computer locks/sleeps). */
  autoLockMinutes: number
  /** The school's logo as a small PNG data URL (resized on upload), or '' for none.
   * Shown in the sidebar and on report cards and other printouts. */
  schoolLogo: string
  /** '#rrggbb' to replace EduBoard's indigo with the school's colour; '' keeps it. */
  accentColor: string
  /** The school's own name for the app, shown in the sidebar, window title and lock
   * screen (shared/branding.ts); '' shows EduBoard. Decorative only. */
  appDisplayName: string
  /** The school's own attendance codes, plus any renaming of the built-in four. */
  attendanceCodes: AttendanceCode[]
  /** Send an anonymous weekly "still using it" ping (shared/usagePing.ts). Off unless
   * the teacher turns it on. */
  usagePing: boolean
  /** Send this app's name and logo when publishing, for the Portal to show families
   * (portal/services/branding.js). On unless the teacher turns it off. */
  portalBranding: boolean
  /** DingTalk / WeCom class groups the teacher can post to (robot webhooks). */
  groupChats: GroupChat[]
  /** What class points are for; empty means EduBoard's five. */
  pointCategories: PointCategory[]
  /** What the family weekly digest includes. */
  digestOptions: DigestOptions
  /** What families see about each assessment on the Portal's Grades page. */
  portalScores: PortalScoreOptions
  /** The teacher's own address, for their weekly summary. */
  teacherEmail: string
  /** Letters, Class Story posts and lesson plans the teacher saved as templates. */
  savedTemplates: SavedTemplate[]
  /** What a printed report card shows; anything missing comes from its preset. */
  reportCard: Partial<ReportCardLayout>
  /** The school's own words for class, student, assessment… per interface language. */
  terminology: Terminology
  /** Interface language; '' follows the computer's language. */
  uiLanguage: 'en' | 'zh' | ''
  textSize: 'small' | 'normal' | 'large' | 'larger'
  highContrast: boolean
  reduceMotion: boolean
  /** The one-tap buttons above a student's log. */
  logQuickAdds: LogQuickAdd[]
  /** Extra things to record about every student (house, allergies, support plan…). */
  studentFields: StudentField[]
  /** A school stylesheet (sanitized: nothing it contains can load from the internet),
   * applied after EduBoard's own. '' for none. */
  customCss: string
  /** Report card sentences with placeholders ({name}, {class}, {grade}, {percent}). */
  commentBank: BankComment[]
  /** The parent letter template (see shared/letters.ts for its placeholders). */
  letterTemplate: string
}

/** What the Portal shows families about each assessment, beyond the overall grade. */
export interface PortalScoreOptions {
  /** Each marked assessment with the student's own score. */
  assessments: boolean
  /** The teacher's comment on each score. Off unless turned on: gradebook comments are
   * often notes for the teacher. */
  comments: boolean
  /** The class average for each assessment, only once 5 or more students have a score (so
   * no one's score can be worked out from it). */
  classAverage: boolean
}

export interface LogQuickAdd {
  label: string
  type: StudentLogType
  text: string
  contactMethod?: ContactMethod
}

export interface StudentField {
  id: string
  label: string
  /** Show an icon on the seating chart for students with something recorded here
   * (allergies, a support plan…). Hidden while presenting. */
  onSeatingChart?: boolean
}

export const DEFAULT_LOG_QUICK_ADDS: LogQuickAdd[] = [
  { label: 'Missed homework', type: 'concern', text: 'Missed homework.' },
  { label: 'Great participation', type: 'positive', text: 'Great participation in class today.' },
  { label: 'Late to class', type: 'concern', text: 'Arrived late to class.' },
  {
    label: 'Called home',
    type: 'contact',
    text: 'Called home to discuss progress.',
    contactMethod: 'phone'
  },
  { label: 'Emailed guardian', type: 'contact', text: 'Emailed guardian.', contactMethod: 'email' }
]

export const DEFAULT_LOG_QUICK_ADDS_ZH: LogQuickAdd[] = [
  { label: '未交作业', type: 'concern', text: '未交作业。' },
  { label: '课堂表现积极', type: 'positive', text: '今天课堂参与非常积极。' },
  { label: '上课迟到', type: 'concern', text: '上课迟到。' },
  { label: '电话家访', type: 'contact', text: '致电家长沟通学习情况。', contactMethod: 'phone' },
  { label: '邮件联系家长', type: 'contact', text: '已发邮件联系家长。', contactMethod: 'email' }
]

/** The built-in quick-add buttons in the interface language. */
export function defaultLogQuickAdds(): LogQuickAdd[] {
  return uiLanguage() === 'zh' ? DEFAULT_LOG_QUICK_ADDS_ZH : DEFAULT_LOG_QUICK_ADDS
}

/** A student whose attendance in a class is under that class's minimum. */
export interface AttendanceWarning {
  studentId: string
  studentName: string
  classId: string
  className: string
  /** 0–1, as in AttendanceSummary. */
  rate: number
  minAttendance: number
  absent: number
  /** Sessions that counted (present, late or absent; excused ones don't). */
  sessions: number
}

/** Whether the Portal shows everything the teacher has here. */
export interface PublishStatus {
  configured: boolean
  /** False when something has changed since the last publish (or there hasn't been one). */
  upToDate: boolean
  lastPublishedAt: string | null
}

/** A student who forgot their Portal password and is waiting for the teacher's OK. */
export interface PortalResetRequest {
  id: string
  username: string
  studentNames: string[]
  requestedAt: string
}

/** What Settings shows for updating EduBoard from inside the app. */
export interface AppUpdateInfo {
  current: string
  /** Newest release; null when it couldn't be checked. */
  latest: string | null
  updateAvailable: boolean
  /** Whether this copy can replace itself (an installed or portable app, not source). */
  canInstall: boolean
  cannotInstallReason: string | null
  /** Why the check failed (offline…), in plain words. */
  problem: string | null
}

export interface AppUpdateProgress {
  phase: 'idle' | 'downloading' | 'ready' | 'installing' | 'failed'
  /** 0–1 while downloading. */
  fraction: number
  error: string | null
}

/** Everything the update icon, the Settings badge and the "update ready" banner need,
 * polled by the window. */
export interface AppUpdateStatus {
  current: string
  /** Newest version seen by the last check; null before one has succeeded. */
  latest: string | null
  /** A newer version exists (downloaded or not). */
  updateAvailable: boolean
  /** A newer version is downloaded and waiting; it installs the next time EduBoard opens
   * (when automatic updates are on) or when the teacher restarts now. */
  readyVersion: string | null
  /** Background download of `latest` in progress, 0–1. */
  downloading: number | null
  /** The last automatic install didn't finish, so it now waits for the teacher. */
  autoInstallFailed: boolean
  canInstall: boolean
  cannotInstallReason: string | null
}

/** Where the second backup copy stands, for Settings and the Dashboard reminder. */
export interface ExtraBackupStatus {
  folder: string
  /** False when a folder is set but can't be reached (e.g. the USB stick is out). */
  reachable: boolean
  /** Newest EduBoard backup in that folder, if any. */
  lastCopiedAt: string | null
  /** True when there's no second copy, or the newest is older than a week. */
  needsAttention: boolean
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
  aiModel: '',
  portalUrl: '',
  portalSyncSecret: '',
  portalAiProvider: 'zhipu',
  portalAiApiKey: '',
  portalAiCustomBaseUrl: '',
  portalAiCustomModel: '',
  portalAiModel: '',
  digestEnabled: false,
  digestSmtpHost: '',
  digestSmtpPort: 587,
  digestSmtpUser: '',
  digestSmtpPass: '',
  digestFromEmail: '',
  digestFromName: '',
  onboardingDismissed: false,
  extraBackupFolder: '',
  autoUpdate: true,
  autoLockMinutes: 10,
  schoolLogo: '',
  accentColor: '',
  appDisplayName: '',
  attendanceCodes: [],
  digestOptions: {
    grades: true,
    attendance: true,
    homework: true,
    classStory: true,
    messages: true,
    points: false
  },
  portalScores: { assessments: true, comments: false, classAverage: false },
  pointCategories: [],
  groupChats: [],
  usagePing: false,
  portalBranding: true,
  teacherEmail: '',
  savedTemplates: [],
  reportCard: {},
  terminology: {},
  uiLanguage: '',
  textSize: 'normal',
  highContrast: false,
  reduceMotion: false,
  logQuickAdds: DEFAULT_LOG_QUICK_ADDS,
  studentFields: [],
  customCss: '',
  commentBank: DEFAULT_COMMENT_BANK,
  letterTemplate: DEFAULT_LETTER_TEMPLATE
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
  /** The class the plan is for: its teaching profile shapes the draft. */
  classId?: string
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
  /** Null when the backup is password-protected with a key this database no longer uses
   * (protection was turned off and on again since), so it can't be looked inside. */
  backup: { students: number; classes: number; scores: number; attendanceRecords: number } | null
  current: { students: number; classes: number; scores: number; attendanceRecords: number }
  /** The backup is encrypted: after restoring, EduBoard asks for the password it had
   * when the backup was made, or that time's recovery key. */
  protectedBackup: boolean
}

export interface SecurityStatus {
  /** Password protection is on (the database is encrypted). */
  protected: boolean
  /** The window must show the lock screen. */
  locked: boolean
  /** After repeated wrong tries, how long before the next one is accepted. */
  retryInSeconds: number
  /** Null while the database is still closed (before the first unlock). */
  autoLockMinutes: number | null
}

/** One +1 or −1 on the Classroom tab. */
export interface BehaviourPoint {
  id: string
  classId: string
  studentId: string
  points: number
  reason: string | null
  /** A point category id (see pointCategories.ts), or null for none. */
  category: string | null
  createdAt: string
}

/** A student's points in a class: this week and all time. */
export interface BehaviourTotal {
  studentId: string
  week: number
  total: number
}

export interface ReportComment {
  id: string
  classId: string
  studentId: string
  text: string
  updatedAt: string
}

/** What the AI is told when suggesting report comment phrases: the same facts the
 * teacher sees, and nothing else. */
export interface SuggestCommentPhrasesInput {
  studentName: string
  className: string
  percent: number | null
  letter: string | null
  attendanceRate: number | null
  recentNotes: string[]
  trendDirection: GradeTrendDirection | null
  trendDeltaPoints: number | null
}

export interface TodayLesson {
  classId: string
  className: string
  classColor: string | null
  startTime: string
  endTime: string
  room: string | null
  attendanceTaken: boolean
  lessonPlanTitle: string | null
}

export interface TodayOverview {
  /** Local date, YYYY-MM-DD. */
  date: string
  lessons: TodayLesson[]
  /** Parent-contact log entries marked for follow-up and not done yet. */
  followUpsDue: number
}

export interface WatchListEntry {
  studentId: string
  studentName: string
  classId: string
  className: string
  reasons: string[]
}

/** Settings whose built-in value has a version in each language. A value that is still
 * one of the built-in versions (in either language) hasn't been changed by the teacher,
 * so it's shown in the interface language; anything the teacher edited stays as is. */
export function withLocalDefaults(settings: AppSettings): AppSettings {
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
  const untouched = (value: unknown, en: unknown, zh: unknown): boolean =>
    same(value, en) || same(value, zh)
  return {
    ...settings,
    logQuickAdds: untouched(
      settings.logQuickAdds,
      DEFAULT_LOG_QUICK_ADDS,
      DEFAULT_LOG_QUICK_ADDS_ZH
    )
      ? defaultLogQuickAdds()
      : settings.logQuickAdds,
    commentBank: untouched(settings.commentBank, DEFAULT_COMMENT_BANK, DEFAULT_COMMENT_BANK_ZH)
      ? defaultCommentBank()
      : settings.commentBank,
    letterTemplate: untouched(
      settings.letterTemplate,
      DEFAULT_LETTER_TEMPLATE,
      DEFAULT_LETTER_TEMPLATE_ZH
    )
      ? defaultLetterTemplate()
      : settings.letterTemplate
  }
}
