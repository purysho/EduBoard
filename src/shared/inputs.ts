// Input shapes for create/update IPC calls. Single source of truth shared by the main
// process (repository function signatures) and the renderer (via the preload API type),
// so the two sides can't silently drift apart.
import type {
  AttendanceRecord,
  ClassScheduleSlot,
  ClassSection,
  CourseGroup,
  Enrollment,
  GradeCategory,
  HomeworkAssignment,
  HomeworkSubmissionStatus,
  LessonPlan,
  Student,
  Term,
  Assessment,
  Standard,
  StudentLogEntry,
  LessonResource,
  ExitTicketQuestion,
  AssignmentSubmission
} from './types'

export type CreateCourseGroupInput = Omit<CourseGroup, 'id' | 'createdAt'>

export type CreateTermInput = Omit<Term, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateTermInput = Partial<CreateTermInput>

export type CreateStudentInput = Omit<Student, 'id' | 'createdAt' | 'updatedAt' | 'archived'> & {
  archived?: boolean
}
export type UpdateStudentInput = Partial<Omit<Student, 'id' | 'createdAt'>>

export type CreateClassInput = Omit<
  ClassSection,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'archived'
  | 'seatingRows'
  | 'seatingCols'
  | 'courseGroupId'
  | 'termWeight'
> & {
  archived?: boolean
  seatingRows?: number
  seatingCols?: number
  courseGroupId?: string | null
  termWeight?: number
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

export type CreateStudentLogEntryInput = Omit<
  StudentLogEntry,
  'id' | 'createdAt' | 'contactMethod' | 'followUpNeeded' | 'followUpDone'
> &
  Partial<Pick<StudentLogEntry, 'contactMethod' | 'followUpNeeded' | 'followUpDone'>>

export type UpdateStudentLogEntryInput = Partial<
  Pick<StudentLogEntry, 'followUpNeeded' | 'followUpDone'>
>

export type UpsertAssignmentSubmissionInput = Omit<AssignmentSubmission, 'id' | 'submittedAt'>

export type CreateClassScheduleSlotInput = Omit<ClassScheduleSlot, 'id' | 'createdAt'>
export type UpdateClassScheduleSlotInput = Partial<
  Omit<ClassScheduleSlot, 'id' | 'classId' | 'createdAt'>
>

export type CreateHomeworkAssignmentInput = Omit<
  HomeworkAssignment,
  'id' | 'createdAt' | 'updatedAt'
>
export type UpdateHomeworkAssignmentInput = Partial<
  Omit<HomeworkAssignment, 'id' | 'classId' | 'createdAt' | 'updatedAt'>
>

export type SetHomeworkSubmissionStatusInput = {
  homeworkAssignmentId: string
  studentId: string
  status: HomeworkSubmissionStatus
}

export type SetHomeworkSubmissionGradeInput = {
  homeworkAssignmentId: string
  studentId: string
  grade: string | null
  feedback: string | null
}

export type SetHomeworkSubmissionPortfolioInput = {
  homeworkAssignmentId: string
  studentId: string
  portfolio: boolean
}

export type CreatePortalInviteBatchInput = { classId: string; count: number }

export type CreateLessonResourceInput = Omit<
  LessonResource,
  'id' | 'createdAt' | 'updatedAt' | 'indexedAt'
>
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
