// Input shapes for create/update IPC calls. Single source of truth shared by the main
// process (repository function signatures) and the renderer (via the preload API type),
// so the two sides can't silently drift apart.
import type {
  AttendanceRecord,
  ClassSection,
  Enrollment,
  GradeCategory,
  LessonPlan,
  Student,
  Term,
  Assessment,
  Standard,
  StudentLogEntry,
  LessonResource,
  ExitTicketQuestion
} from './types'

export type CreateTermInput = Omit<Term, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateTermInput = Partial<CreateTermInput>

export type CreateStudentInput = Omit<Student, 'id' | 'createdAt' | 'updatedAt' | 'archived'> & {
  archived?: boolean
}
export type UpdateStudentInput = Partial<Omit<Student, 'id' | 'createdAt'>>

export type CreateClassInput = Omit<ClassSection, 'id' | 'createdAt' | 'updatedAt' | 'archived'> & {
  archived?: boolean
}
export type UpdateClassInput = Partial<Omit<ClassSection, 'id' | 'createdAt'>>

export type CreateGradeCategoryInput = Omit<GradeCategory, 'id' | 'createdAt'>
export type UpdateGradeCategoryInput = Partial<Omit<GradeCategory, 'id' | 'classId' | 'createdAt'>>

export type CreateEnrollmentInput = Omit<Enrollment, 'id' | 'createdAt' | 'status'> & {
  status?: Enrollment['status']
}

export type CreateAssessmentInput = Omit<
  Assessment,
  'id' | 'createdAt' | 'updatedAt' | 'isFinal' | 'sortOrder' | 'rubricId'
> & { isFinal?: boolean; sortOrder?: number; rubricId?: string | null }
export type UpdateAssessmentInput = Partial<Omit<Assessment, 'id' | 'classId' | 'createdAt'>>

export type UpsertScoreInput = {
  assessmentId: string
  studentId: string
  pointsEarned: number | null
  excused?: boolean
  late?: boolean
  comment?: string | null
}

export type MarkAttendanceInput = {
  classId: string
  studentId: string
  date: string
  status: AttendanceRecord['status']
  note?: string | null
}

export type CreateLessonPlanInput = Omit<
  LessonPlan,
  'id' | 'createdAt' | 'updatedAt' | 'status'
> & { status?: LessonPlan['status'] }
export type UpdateLessonPlanInput = Partial<Omit<LessonPlan, 'id' | 'classId' | 'createdAt'>>

export type CreateStandardInput = Omit<Standard, 'id' | 'createdAt'>
export type UpdateStandardInput = Partial<Omit<Standard, 'id' | 'createdAt'>>

/** A criterion as submitted by the rubric builder — its levels inline, since a rubric
 * is always authored and saved as one whole tree rather than criterion-by-criterion. */
export type RubricCriterionDraft = {
  id?: string
  name: string
  description?: string | null
  standardId?: string | null
  levels: { id?: string; label: string; points: number; description?: string | null }[]
}

export type CreateRubricInput = {
  name: string
  description?: string | null
  criteria: RubricCriterionDraft[]
}
export type UpdateRubricInput = CreateRubricInput

/** One student's full rubric grading for one assessment — a level choice per criterion. */
export type SaveRubricScoresInput = {
  assessmentId: string
  studentId: string
  selections: { criterionId: string; levelId: string }[]
  comment?: string | null
}

export type CreateStudentLogEntryInput = Omit<StudentLogEntry, 'id' | 'createdAt'>

export type CreateLessonResourceInput = Omit<LessonResource, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateLessonResourceInput = Partial<CreateLessonResourceInput>

/** The teacher's editable exit-ticket setup for a class — title + question list. Saved
 * as a whole (like a rubric's criteria) since questions are always authored together. */
export type UpsertExitTicketInput = {
  classId: string
  title: string
  questions: ExitTicketQuestion[]
}

export type SubmitExitTicketResponseInput = {
  exitTicketId: string
  studentName: string
  answers: Record<string, string>
}
