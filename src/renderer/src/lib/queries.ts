import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppSettings, EnrollmentStatus } from '@shared/types'
import type {
  CreateAssessmentInput,
  CreateClassInput,
  CreateEnrollmentInput,
  CreateGradeCategoryInput,
  CreateLessonPlanInput,
  CreateStudentInput,
  CreateTermInput,
  MarkAttendanceInput,
  UpdateAssessmentInput,
  UpdateClassInput,
  UpdateGradeCategoryInput,
  UpdateLessonPlanInput,
  UpdateStudentInput,
  UpdateTermInput,
  UpsertScoreInput
} from '@shared/inputs'

const api = () => window.api

export const queryKeys = {
  students: ['students'] as const,
  student: (id: string) => ['students', id] as const,
  terms: ['terms'] as const,
  classes: ['classes'] as const,
  classById: (id: string) => ['classes', id] as const,
  gradeCategories: (classId: string) => ['classes', classId, 'gradeCategories'] as const,
  enrollmentsByClass: (classId: string) => ['classes', classId, 'enrollments'] as const,
  enrollmentsByStudent: (studentId: string) => ['students', studentId, 'enrollments'] as const,
  assessments: (classId: string) => ['classes', classId, 'assessments'] as const,
  scoresByAssessment: (assessmentId: string) => ['assessments', assessmentId, 'scores'] as const,
  scoresByClass: (classId: string) => ['classes', classId, 'scores'] as const,
  scoresByStudentClass: (studentId: string, classId: string) =>
    ['students', studentId, 'classes', classId, 'scores'] as const,
  attendanceByClass: (classId: string) => ['classes', classId, 'attendance'] as const,
  attendanceByStudentClass: (studentId: string, classId: string) =>
    ['students', studentId, 'classes', classId, 'attendance'] as const,
  lessonPlans: (classId: string) => ['classes', classId, 'lessonPlans'] as const,
  upcomingLessonPlans: ['lessonPlans', 'upcoming'] as const,
  dashboardStats: ['dashboardStats'] as const,
  classRoster: (classId: string) => ['classes', classId, 'roster'] as const,
  classReport: (classId: string) => ['classes', classId, 'report'] as const,
  studentClassGrade: (studentId: string, classId: string) =>
    ['students', studentId, 'classes', classId, 'grade'] as const,
  settings: ['settings'] as const,
  backups: ['backups'] as const
}

// ---- Students -----------------------------------------------------------------------

export function useStudents(includeArchived = false) {
  return useQuery({
    queryKey: [...queryKeys.students, includeArchived],
    queryFn: () => api().students.list(includeArchived)
  })
}

export function useCreateStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStudentInput) => api().students.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.students })
  })
}

export function useUpdateStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateStudentInput }) =>
      api().students.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.students })
  })
}

export function useDeleteStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().students.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.students })
  })
}

// ---- Terms ----------------------------------------------------------------------------

export function useTerms() {
  return useQuery({ queryKey: queryKeys.terms, queryFn: () => api().terms.list() })
}

export function useCreateTerm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTermInput) => api().terms.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.terms })
  })
}

export function useUpdateTerm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTermInput }) =>
      api().terms.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.terms })
  })
}

export function useDeleteTerm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().terms.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.terms })
  })
}

// ---- Classes --------------------------------------------------------------------------

export function useClasses(includeArchived = false) {
  return useQuery({
    queryKey: [...queryKeys.classes, includeArchived],
    queryFn: () => api().classes.list(includeArchived)
  })
}

export function useClass(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.classById(id ?? ''),
    queryFn: async () => {
      const all = await api().classes.list(true)
      return all.find((c) => c.id === id) ?? null
    },
    enabled: !!id
  })
}

export function useCreateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateClassInput) => api().classes.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes })
  })
}

export function useUpdateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateClassInput }) =>
      api().classes.update(id, patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.classes })
      qc.invalidateQueries({ queryKey: queryKeys.classById(vars.id) })
    }
  })
}

export function useDeleteClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().classes.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes })
  })
}

// ---- Grade categories -------------------------------------------------------------------

export function useGradeCategories(classId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.gradeCategories(classId ?? ''),
    queryFn: () => api().gradeCategories.listByClass(classId!),
    enabled: !!classId
  })
}

export function useCreateGradeCategory(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateGradeCategoryInput) => api().gradeCategories.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.gradeCategories(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
    }
  })
}

export function useUpdateGradeCategory(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateGradeCategoryInput }) =>
      api().gradeCategories.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.gradeCategories(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
    }
  })
}

export function useDeleteGradeCategory(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().gradeCategories.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.gradeCategories(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
    }
  })
}

// ---- Enrollments ----------------------------------------------------------------------

export function useEnrollmentsByStudent(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.enrollmentsByStudent(studentId ?? ''),
    queryFn: () => api().enrollments.listByStudent(studentId!),
    enabled: !!studentId
  })
}

export function useEnrollStudent(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateEnrollmentInput) => api().enrollments.enroll(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
    }
  })
}

export function useUpdateEnrollmentStatus(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: EnrollmentStatus }) =>
      api().enrollments.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
    }
  })
}

export function useUnenrollStudent(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (studentId: string) => api().enrollments.unenroll(studentId, classId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
    }
  })
}

// ---- Assessments ------------------------------------------------------------------------

export function useAssessments(classId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assessments(classId ?? ''),
    queryFn: () => api().assessments.listByClass(classId!),
    enabled: !!classId
  })
}

export function useCreateAssessment(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAssessmentInput) => api().assessments.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.assessments(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classReport(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
    }
  })
}

export function useUpdateAssessment(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateAssessmentInput }) =>
      api().assessments.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.assessments(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classReport(classId) })
    }
  })
}

export function useDeleteAssessment(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().assessments.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.assessments(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classReport(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
    }
  })
}

// ---- Scores ---------------------------------------------------------------------------

export function useScoresByAssessment(assessmentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.scoresByAssessment(assessmentId ?? ''),
    queryFn: () => api().scores.listByAssessment(assessmentId!),
    enabled: !!assessmentId
  })
}

export function useScoresByClass(classId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.scoresByClass(classId ?? ''),
    queryFn: () => api().scores.listByClass(classId!),
    enabled: !!classId
  })
}

export function useScoresByStudentClass(
  studentId: string | undefined,
  classId: string | undefined
) {
  return useQuery({
    queryKey: queryKeys.scoresByStudentClass(studentId ?? '', classId ?? ''),
    queryFn: () => api().scores.listByStudentAndClass(studentId!, classId!),
    enabled: !!studentId && !!classId
  })
}

export function useUpsertScore(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertScoreInput) => api().scores.upsert(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.scoresByAssessment(vars.assessmentId) })
      qc.invalidateQueries({ queryKey: queryKeys.scoresByClass(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classReport(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
    }
  })
}

export function useUpsertScoresBulk(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inputs: UpsertScoreInput[]) => api().scores.upsertBulk(inputs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.assessments(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.scoresByClass(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classReport(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
    }
  })
}

// ---- Attendance -----------------------------------------------------------------------

export function useAttendanceByClass(classId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.attendanceByClass(classId ?? ''),
    queryFn: () => api().attendance.listByClass(classId!),
    enabled: !!classId
  })
}

export function useAttendanceByStudentClass(
  studentId: string | undefined,
  classId: string | undefined
) {
  return useQuery({
    queryKey: queryKeys.attendanceByStudentClass(studentId ?? '', classId ?? ''),
    queryFn: () => api().attendance.listByStudentAndClass(studentId!, classId!),
    enabled: !!studentId && !!classId
  })
}

export function useMarkAttendance(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MarkAttendanceInput) => api().attendance.mark(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.attendanceByClass(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classReport(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
    }
  })
}

export function useMarkAttendanceBulk(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inputs: MarkAttendanceInput[]) => api().attendance.markBulk(inputs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.attendanceByClass(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classReport(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
    }
  })
}

// ---- Lesson plans -----------------------------------------------------------------------

export function useLessonPlans(classId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lessonPlans(classId ?? ''),
    queryFn: () => api().lessonPlans.listByClass(classId!),
    enabled: !!classId
  })
}

export function useUpcomingLessonPlans(limit = 5) {
  return useQuery({
    queryKey: [...queryKeys.upcomingLessonPlans, limit],
    queryFn: () => api().lessonPlans.listUpcoming(new Date().toISOString().slice(0, 10), limit)
  })
}

export function useCreateLessonPlan(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLessonPlanInput) => api().lessonPlans.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lessonPlans(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.upcomingLessonPlans })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
    }
  })
}

export function useUpdateLessonPlan(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateLessonPlanInput }) =>
      api().lessonPlans.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lessonPlans(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.upcomingLessonPlans })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
    }
  })
}

export function useDeleteLessonPlan(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().lessonPlans.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lessonPlans(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.upcomingLessonPlans })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
    }
  })
}

// ---- Reports --------------------------------------------------------------------------

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => api().reports.dashboardStats()
  })
}

export function useClassRoster(classId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.classRoster(classId ?? ''),
    queryFn: () => api().reports.classRoster(classId!),
    enabled: !!classId
  })
}

export function useClassReport(classId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.classReport(classId ?? ''),
    queryFn: () => api().reports.classReport(classId!),
    enabled: !!classId
  })
}

export function useStudentClassGrade(studentId: string | undefined, classId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.studentClassGrade(studentId ?? '', classId ?? ''),
    queryFn: () => api().reports.studentClassGrade(studentId!, classId!),
    enabled: !!studentId && !!classId
  })
}

export function useStudentAttendanceSummary(
  studentId: string | undefined,
  classId: string | undefined
) {
  return useQuery({
    queryKey: ['students', studentId ?? '', 'classes', classId ?? '', 'attendanceSummary'] as const,
    queryFn: () => api().reports.studentAttendanceSummary(studentId!, classId!),
    enabled: !!studentId && !!classId
  })
}

// ---- Settings & backups -----------------------------------------------------------------

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => api().settings.get() })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<AppSettings>) => api().settings.update(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings })
  })
}

export function useBackups() {
  return useQuery({ queryKey: queryKeys.backups, queryFn: () => api().backup.list() })
}

export function useCreateBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api().backup.create(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.backups })
  })
}

export function useBackupPreview(filePath: string | null) {
  return useQuery({
    queryKey: [...queryKeys.backups, 'preview', filePath],
    queryFn: () => api().backup.preview(filePath as string),
    enabled: !!filePath
  })
}
