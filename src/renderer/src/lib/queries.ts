import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AppSettings,
  DraftLessonPlanInput,
  DraftReportCommentInput,
  EnrollmentStatus
} from '@shared/types'
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
  UpsertScoreInput,
  CreateStandardInput,
  UpdateStandardInput,
  CreateRubricInput,
  UpdateRubricInput,
  SaveRubricScoresInput,
  CreateStudentLogEntryInput,
  UpdateStudentLogEntryInput,
  CreateLessonResourceInput,
  UpdateLessonResourceInput,
  UpsertExitTicketInput,
  UpsertAssignmentSubmissionInput,
  CreateCourseGroupInput,
  CreateClassScheduleSlotInput,
  CreateHomeworkAssignmentInput,
  UpdateHomeworkAssignmentInput,
  SetHomeworkSubmissionStatusInput
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
  attendanceCheckInStatus: (classId: string) => ['classes', classId, 'attendanceCheckIn'] as const,
  lessonPlans: (classId: string) => ['classes', classId, 'lessonPlans'] as const,
  upcomingLessonPlans: ['lessonPlans', 'upcoming'] as const,
  dashboardStats: ['dashboardStats'] as const,
  analyticsOverview: ['analyticsOverview'] as const,
  allScheduleSlots: ['scheduleSlots'] as const,
  homeworkAssignments: (classId: string) => ['classes', classId, 'homework'] as const,
  homeworkSubmissions: (homeworkAssignmentId: string) =>
    ['homework', homeworkAssignmentId, 'submissions'] as const,
  portalInviteBatches: (classId: string) => ['classes', classId, 'inviteBatches'] as const,
  classRoster: (classId: string) => ['classes', classId, 'roster'] as const,
  classReport: (classId: string) => ['classes', classId, 'report'] as const,
  studentClassGrade: (studentId: string, classId: string) =>
    ['students', studentId, 'classes', classId, 'grade'] as const,
  settings: ['settings'] as const,
  backups: ['backups'] as const,
  standards: ['standards'] as const,
  rubrics: ['rubrics'] as const,
  rubric: (id: string) => ['rubrics', id] as const,
  rubricScores: (assessmentId: string, studentId: string) =>
    ['assessments', assessmentId, 'students', studentId, 'rubricScores'] as const,
  studentLogEntries: (studentId: string) => ['students', studentId, 'logEntries'] as const,
  parentCommunications: ['parentCommunications'] as const,
  lessonResources: ['lessonResources'] as const,
  assignmentSubmissions: (assessmentId: string) =>
    ['assessments', assessmentId, 'submissions'] as const,
  assignmentSubmissionsByClass: (classId: string) => ['classes', classId, 'submissions'] as const,
  seatAssignments: (classId: string) => ['classes', classId, 'seatAssignments'] as const,
  courseGroups: ['courseGroups'] as const,
  courseGroupComposite: (courseGroupId: string) =>
    ['courseGroups', courseGroupId, 'composite'] as const,
  exitTicketByClass: (classId: string) => ['classes', classId, 'exitTicket'] as const,
  exitTicketResponses: (exitTicketId: string) =>
    ['exitTickets', exitTicketId, 'responses'] as const,
  exitTicketServerInfo: ['exitTicketServerInfo'] as const
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

export function useScoreHistory(
  assessmentId: string | undefined,
  studentId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['scoreHistory', assessmentId, studentId],
    queryFn: () => api().scores.history(assessmentId!, studentId!),
    enabled: enabled && !!assessmentId && !!studentId
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
      qc.invalidateQueries({ queryKey: ['scoreHistory', vars.assessmentId, vars.studentId] })
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

/** Polls while a check-in session is open so the teacher sees students land live,
 * without any push mechanism from the local server (same pattern as exit tickets). */
export function useAttendanceCheckInStatus(classId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.attendanceCheckInStatus(classId),
    queryFn: () => api().attendanceCheckIn.getStatus(classId),
    enabled,
    refetchInterval: enabled ? 3000 : false
  })
}

export function useOpenAttendanceCheckIn(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (date: string) => api().attendanceCheckIn.open(classId, date),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.attendanceCheckInStatus(classId) })
  })
}

export function useCloseAttendanceCheckIn(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api().attendanceCheckIn.close(classId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.attendanceCheckInStatus(classId) })
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

// ---- Timetable ----------------------------------------------------------------------------

export function useAllScheduleSlots() {
  return useQuery({
    queryKey: queryKeys.allScheduleSlots,
    queryFn: () => api().scheduleSlots.listAll()
  })
}

export function useCreateScheduleSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateClassScheduleSlotInput) => api().scheduleSlots.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.allScheduleSlots })
  })
}

export function useDeleteScheduleSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().scheduleSlots.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.allScheduleSlots })
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

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: queryKeys.analyticsOverview,
    queryFn: () => api().reports.analyticsOverview()
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

// ---- Standards --------------------------------------------------------------------------

export function useStandards() {
  return useQuery({ queryKey: queryKeys.standards, queryFn: () => api().standards.list() })
}

export function useCreateStandard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStandardInput) => api().standards.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.standards })
  })
}

export function useUpdateStandard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateStandardInput }) =>
      api().standards.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.standards })
  })
}

export function useDeleteStandard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().standards.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.standards })
  })
}

// ---- Rubrics ------------------------------------------------------------------------------

export function useRubrics() {
  return useQuery({ queryKey: queryKeys.rubrics, queryFn: () => api().rubrics.list() })
}

export function useRubric(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.rubric(id ?? ''),
    queryFn: () => api().rubrics.get(id!),
    enabled: !!id
  })
}

export function useCreateRubric() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateRubricInput) => api().rubrics.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rubrics })
  })
}

export function useUpdateRubric() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRubricInput }) =>
      api().rubrics.update(id, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.rubrics })
      qc.invalidateQueries({ queryKey: queryKeys.rubric(vars.id) })
    }
  })
}

export function useDeleteRubric() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().rubrics.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rubrics })
  })
}

// ---- Rubric scores --------------------------------------------------------------------------

export function useRubricScores(assessmentId: string | undefined, studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.rubricScores(assessmentId ?? '', studentId ?? ''),
    queryFn: () => api().rubricScores.list(assessmentId!, studentId!),
    enabled: !!assessmentId && !!studentId
  })
}

export function useSaveRubricScores(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveRubricScoresInput) => api().rubricScores.save(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.rubricScores(vars.assessmentId, vars.studentId)
      })
      qc.invalidateQueries({ queryKey: queryKeys.scoresByAssessment(vars.assessmentId) })
      qc.invalidateQueries({ queryKey: queryKeys.scoresByClass(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.classReport(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardStats })
      qc.invalidateQueries({
        queryKey: ['scoreHistory', vars.assessmentId, vars.studentId]
      })
    }
  })
}

// ---- Student log entries -----------------------------------------------------------------

export function useStudentLogEntries(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.studentLogEntries(studentId ?? ''),
    queryFn: () => api().studentLogEntries.listByStudent(studentId!),
    enabled: !!studentId
  })
}

export function useCreateStudentLogEntry(studentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStudentLogEntryInput) => api().studentLogEntries.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.studentLogEntries(studentId) })
  })
}

export function useDeleteStudentLogEntry(studentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().studentLogEntries.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.studentLogEntries(studentId) })
  })
}

/** Used from both the per-student log panel and the standalone Communications page — the
 * caller passes the owning studentId so both views' caches invalidate correctly. */
export function useUpdateStudentLogEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch
    }: {
      id: string
      studentId: string
      patch: UpdateStudentLogEntryInput
    }) => api().studentLogEntries.update(id, patch),
    onSuccess: (_data, { studentId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.studentLogEntries(studentId) })
      qc.invalidateQueries({ queryKey: queryKeys.parentCommunications })
    }
  })
}

// ---- Parent communications -----------------------------------------------------------------

export function useParentCommunications() {
  return useQuery({
    queryKey: queryKeys.parentCommunications,
    queryFn: () => api().studentLogEntries.listParentCommunications()
  })
}

// ---- Lesson resources ---------------------------------------------------------------------

export function useLessonResources() {
  return useQuery({
    queryKey: queryKeys.lessonResources,
    queryFn: () => api().lessonResources.list()
  })
}

export function useCreateLessonResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLessonResourceInput) => api().lessonResources.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.lessonResources })
  })
}

export function useUpdateLessonResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateLessonResourceInput }) =>
      api().lessonResources.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.lessonResources })
  })
}

export function useDeleteLessonResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().lessonResources.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.lessonResources })
  })
}

// ---- Course groups / composite grades -----------------------------------------------------

export function useCourseGroups() {
  return useQuery({ queryKey: queryKeys.courseGroups, queryFn: () => api().courseGroups.list() })
}

export function useCreateCourseGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCourseGroupInput) => api().courseGroups.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.courseGroups })
  })
}

export function useRenameCourseGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api().courseGroups.rename(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.courseGroups })
  })
}

export function useDeleteCourseGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().courseGroups.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.courseGroups })
      qc.invalidateQueries({ queryKey: queryKeys.classes })
    }
  })
}

export function useCourseGroupComposite(courseGroupId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.courseGroupComposite(courseGroupId ?? ''),
    queryFn: () => api().courseGroups.getComposite(courseGroupId!),
    enabled: !!courseGroupId
  })
}

// ---- Seat assignments -------------------------------------------------------------------------

export function useSeatAssignments(classId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.seatAssignments(classId ?? ''),
    queryFn: () => api().seatAssignments.listByClass(classId!),
    enabled: !!classId
  })
}

export function useAssignSeat(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ studentId, row, col }: { studentId: string; row: number; col: number }) =>
      api().seatAssignments.assignSeat(classId, studentId, row, col),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.seatAssignments(classId) })
  })
}

export function useUnassignSeat(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (studentId: string) => api().seatAssignments.unassignSeat(classId, studentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.seatAssignments(classId) })
  })
}

export function useClearSeatingChart(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api().seatAssignments.clear(classId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.seatAssignments(classId) })
  })
}

// ---- Assignment submissions -----------------------------------------------------------------

export function useAssignmentSubmissions(assessmentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assignmentSubmissions(assessmentId ?? ''),
    queryFn: () => api().assignmentSubmissions.listByAssessment(assessmentId!),
    enabled: !!assessmentId
  })
}

export function useAssignmentSubmissionsByClass(classId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assignmentSubmissionsByClass(classId ?? ''),
    queryFn: () => api().assignmentSubmissions.listByClass(classId!),
    enabled: !!classId
  })
}

export function useUpsertAssignmentSubmission(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertAssignmentSubmissionInput) =>
      api().assignmentSubmissions.upsert(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.assignmentSubmissions(vars.assessmentId) })
      qc.invalidateQueries({ queryKey: queryKeys.assignmentSubmissionsByClass(classId) })
    }
  })
}

export function useDeleteAssignmentSubmission(classId: string, assessmentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().assignmentSubmissions.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.assignmentSubmissions(assessmentId) })
      qc.invalidateQueries({ queryKey: queryKeys.assignmentSubmissionsByClass(classId) })
    }
  })
}

// ---- Exit tickets ---------------------------------------------------------------------------

export function useExitTicket(classId: string) {
  return useQuery({
    queryKey: queryKeys.exitTicketByClass(classId),
    queryFn: () => api().exitTickets.getByClass(classId)
  })
}

export function useUpsertExitTicket(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertExitTicketInput) => api().exitTickets.upsert(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.exitTicketByClass(classId) })
  })
}

export function useSetExitTicketOpen(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isOpen }: { id: string; isOpen: boolean }) =>
      api().exitTickets.setOpen(id, isOpen),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.exitTicketByClass(classId) })
      qc.invalidateQueries({ queryKey: queryKeys.exitTicketServerInfo })
    }
  })
}

/** Polls while a session is open so the teacher sees responses land live, without
 * needing any push mechanism from the local server. */
export function useExitTicketResponses(exitTicketId: string | undefined, isOpen: boolean) {
  return useQuery({
    queryKey: queryKeys.exitTicketResponses(exitTicketId ?? ''),
    queryFn: () => api().exitTickets.listResponses(exitTicketId!),
    enabled: !!exitTicketId,
    refetchInterval: isOpen ? 3000 : false
  })
}

export function useClearExitTicketResponses(exitTicketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api().exitTickets.clearResponses(exitTicketId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.exitTicketResponses(exitTicketId) })
  })
}

export function useExitTicketServerInfo(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.exitTicketServerInfo,
    queryFn: () => api().exitTickets.getServerInfo(),
    enabled
  })
}

/** The exit-ticket server is really the one shared classroom LAN server — attendance
 * QR check-in runs on it too, so this is just a clearer name at the call site for the
 * same underlying query. */
export const useClassroomServerInfo = useExitTicketServerInfo

// ---- AI drafting (optional, requires a teacher-supplied API key) --------------------------

export function useDraftLessonPlan() {
  return useMutation({
    mutationFn: (input: DraftLessonPlanInput) => api().ai.draftLessonPlan(input)
  })
}

export function useDraftReportComment() {
  return useMutation({
    mutationFn: (input: DraftReportCommentInput) => api().ai.draftReportComment(input)
  })
}

// ---- Homework assignments -------------------------------------------------------------------

export function useHomeworkAssignments(classId: string) {
  return useQuery({
    queryKey: queryKeys.homeworkAssignments(classId),
    queryFn: () => api().homeworkAssignments.listByClass(classId)
  })
}

export function useCreateHomeworkAssignment(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateHomeworkAssignmentInput) => api().homeworkAssignments.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.homeworkAssignments(classId) })
  })
}

export function useUpdateHomeworkAssignment(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateHomeworkAssignmentInput }) =>
      api().homeworkAssignments.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.homeworkAssignments(classId) })
  })
}

export function useDeleteHomeworkAssignment(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api().homeworkAssignments.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.homeworkAssignments(classId) })
  })
}

export function useHomeworkSubmissions(homeworkAssignmentId: string, classId: string) {
  return useQuery({
    queryKey: queryKeys.homeworkSubmissions(homeworkAssignmentId),
    queryFn: () => api().homeworkAssignments.listSubmissions(homeworkAssignmentId, classId)
  })
}

export function useSetHomeworkSubmissionStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetHomeworkSubmissionStatusInput) =>
      api().homeworkAssignments.setSubmissionStatus(input),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({
        queryKey: queryKeys.homeworkSubmissions(vars.homeworkAssignmentId)
      })
  })
}

// ---- Portal invites ---------------------------------------------------------------------------

export function usePortalInviteBatches(classId: string) {
  return useQuery({
    queryKey: queryKeys.portalInviteBatches(classId),
    queryFn: () => api().portalInvites.listBatchesByClass(classId)
  })
}

export function usePortalInviteBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: ['inviteBatch', batchId ?? ''] as const,
    queryFn: () => api().portalInvites.getBatch(batchId!),
    enabled: !!batchId
  })
}

export function useCreatePortalInviteBatch(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (count: number) => api().portalInvites.createBatch({ classId, count }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.portalInviteBatches(classId) })
  })
}

export function useRevokePortalInvite(classId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) => api().portalInvites.revoke(inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.portalInviteBatches(classId) })
  })
}
