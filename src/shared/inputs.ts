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
  Assessment
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
  'id' | 'createdAt' | 'updatedAt' | 'isFinal' | 'sortOrder'
> & { isFinal?: boolean; sortOrder?: number }
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
