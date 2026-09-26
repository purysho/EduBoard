// The typed shape of window.api, implemented by src/preload/index.ts and declared for
// the renderer in src/preload/index.d.ts. Keeping the contract here means both sides are
// checked against the same interface instead of preload's object literal being trusted.
import type { SetupProgress } from './setupChecklist'
import type { PortalAiInteraction } from './aiUsage'
import type { PortalJoinLink, PortalJoinLinksOverview, PublishResult } from './types'
import type {
  FeedbackDraft,
  PortalStudentProfile,
  AnalyticsOverview,
  AppSettings,
  Assessment,
  AttendanceCheckInStatus,
  AttendanceRecord,
  AttendanceSummary,
  GradeTrendPoint,
  BackupInfo,
  ExtraBackupStatus,
  AppUpdateInfo,
  AppUpdateProgress,
  PortalResetRequest,
  PublishStatus,
  AttendanceWarning,
  BackupPreview,
  ClassScheduleSlot,
  ClassScheduleSlotWithClass,
  DeviceSyncStatus,
  DraftedLessonPlan,
  DraftLessonPlanInput,
  DraftReportCommentInput,
  AiConnectionConfig,
  AiConnectionTestResult,
  HomeworkAssignment,
  HomeworkAssignmentWithClass,
  AuditLogEntry,
  HomeworkQuestion,
  HomeworkRubricScore,
  HomeworkSubmission,
  HomeworkSubmissionWithStudent,
  NotebookAnswer,
  PortalInviteBatchWithInvites,
  PortalMessageThread,
  ClassPost,
  ScoreHistoryEntry,
  ClassReport,
  ClassRosterRow,
  ClassSection,
  CourseGroup,
  StudentCompositeGrade,
  DashboardStats,
  Enrollment,
  EnrollmentStatus,
  GradeCategory,
  LessonPlan,
  Score,
  Student,
  StudentClassGrade,
  Term,
  Standard,
  RubricWithCriteria,
  RubricScore,
  StudentLogEntry,
  ParentCommunicationEntry,
  LessonResource,
  AssignmentSubmission,
  SeatAssignment,
  ExitTicket,
  ExitTicketResponse,
  ExitTicketServerInfo
} from './types'
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
  DuplicateClassForNewTermInput,
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
  SaveHomeworkRubricScoresInput,
  DraftHomeworkQuestion,
  CreateStudentLogEntryInput,
  UpdateStudentLogEntryInput,
  CreateLessonResourceInput,
  UpdateLessonResourceInput,
  UpsertExitTicketInput,
  UpsertAssignmentSubmissionInput,
  CreateCourseGroupInput,
  CreateClassScheduleSlotInput,
  UpdateClassScheduleSlotInput,
  CreateHomeworkAssignmentInput,
  UpdateHomeworkAssignmentInput,
  SetHomeworkSubmissionStatusInput,
  SetHomeworkSubmissionGradeInput,
  SetHomeworkSubmissionPortfolioInput,
  CreatePortalInviteBatchInput
} from './inputs'
import type { RosterImportResult } from './importExportTypes'

export interface EduBoardApi {
  students: {
    list(includeArchived?: boolean): Promise<Student[]>
    create(input: CreateStudentInput): Promise<Student>
    update(id: string, patch: UpdateStudentInput): Promise<Student>
    remove(id: string): Promise<void>
    /** Folds duplicateId into keepId here and on the Portal (login included). */
    merge(keepId: string, duplicateId: string): Promise<Student>
  }
  terms: {
    list(): Promise<Term[]>
    create(input: CreateTermInput): Promise<Term>
    update(id: string, patch: UpdateTermInput): Promise<Term>
    remove(id: string): Promise<void>
  }
  classes: {
    list(includeArchived?: boolean): Promise<ClassSection[]>
    create(input: CreateClassInput): Promise<ClassSection>
    update(id: string, patch: UpdateClassInput): Promise<ClassSection>
    remove(id: string): Promise<void>
    duplicateForNewTerm(id: string, input: DuplicateClassForNewTermInput): Promise<ClassSection>
  }
  gradeCategories: {
    listByClass(classId: string): Promise<GradeCategory[]>
    create(input: CreateGradeCategoryInput): Promise<GradeCategory>
    update(id: string, patch: UpdateGradeCategoryInput): Promise<GradeCategory>
    remove(id: string): Promise<void>
  }
  enrollments: {
    listByClass(classId: string): Promise<Enrollment[]>
    listByStudent(studentId: string): Promise<Enrollment[]>
    enroll(input: CreateEnrollmentInput): Promise<Enrollment>
    updateStatus(id: string, status: EnrollmentStatus): Promise<void>
    unenroll(studentId: string, classId: string): Promise<void>
  }
  assessments: {
    listByClass(classId: string): Promise<Assessment[]>
    create(input: CreateAssessmentInput): Promise<Assessment>
    update(id: string, patch: UpdateAssessmentInput): Promise<Assessment>
    remove(id: string): Promise<void>
  }
  scores: {
    listByAssessment(assessmentId: string): Promise<Score[]>
    listByClass(classId: string): Promise<Score[]>
    listByStudentAndClass(studentId: string, classId: string): Promise<Score[]>
    upsert(input: UpsertScoreInput): Promise<Score>
    upsertBulk(inputs: UpsertScoreInput[]): Promise<void>
    history(assessmentId: string, studentId: string): Promise<ScoreHistoryEntry[]>
  }
  attendance: {
    listByClass(classId: string): Promise<AttendanceRecord[]>
    listByStudentAndClass(studentId: string, classId: string): Promise<AttendanceRecord[]>
    mark(input: MarkAttendanceInput): Promise<AttendanceRecord>
    markBulk(inputs: MarkAttendanceInput[]): Promise<void>
  }
  attendanceCheckIn: {
    getStatus(classId: string): Promise<AttendanceCheckInStatus>
    open(classId: string, date: string): Promise<AttendanceCheckInStatus>
    close(classId: string): Promise<void>
  }
  lessonPlans: {
    listByClass(classId: string): Promise<LessonPlan[]>
    listUpcoming(fromDate: string, limit?: number): Promise<LessonPlan[]>
    create(input: CreateLessonPlanInput): Promise<LessonPlan>
    update(id: string, patch: UpdateLessonPlanInput): Promise<LessonPlan>
    remove(id: string): Promise<void>
  }
  scheduleSlots: {
    listByClass(classId: string): Promise<ClassScheduleSlot[]>
    listAll(): Promise<ClassScheduleSlotWithClass[]>
    create(input: CreateClassScheduleSlotInput): Promise<ClassScheduleSlot>
    update(id: string, patch: UpdateClassScheduleSlotInput): Promise<ClassScheduleSlot>
    remove(id: string): Promise<void>
  }
  reports: {
    dashboardStats(): Promise<DashboardStats>
    attendanceWarnings(): Promise<AttendanceWarning[]>
    /** Facts behind the Dashboard's Getting started checklist. */
    setupProgress(): Promise<SetupProgress>
    classRoster(classId: string): Promise<ClassRosterRow[]>
    classReport(classId: string): Promise<ClassReport | null>
    studentClassGrade(studentId: string, classId: string): Promise<StudentClassGrade | null>
    studentAttendanceSummary(studentId: string, classId: string): Promise<AttendanceSummary>
    analyticsOverview(): Promise<AnalyticsOverview>
    studentGradeTrend(studentId: string, classId: string): Promise<GradeTrendPoint[]>
  }
  settings: {
    get(): Promise<AppSettings>
    update(patch: Partial<AppSettings>): Promise<AppSettings>
    /** Asks (through the Portal when set up, else GitHub) whether a newer release exists. */
    appUpdateInfo(): Promise<AppUpdateInfo>
    /** Backs up, downloads and installs the newest release, then EduBoard restarts. */
    installAppUpdate(): Promise<void>
    appUpdateProgress(): Promise<AppUpdateProgress>
  }
  backup: {
    create(): Promise<BackupInfo>
    list(): Promise<BackupInfo[]>
    preview(filePath: string): Promise<BackupPreview>
    restore(filePath: string): Promise<void>
    revealFolder(): Promise<void>
    extraStatus(): Promise<ExtraBackupStatus>
    /** Opens a folder picker; null when cancelled. Backs up there straight away. */
    chooseExtraFolder(): Promise<ExtraBackupStatus | null>
    clearExtraFolder(): Promise<ExtraBackupStatus>
  }
  deviceSync: {
    check(): Promise<DeviceSyncStatus>
  }
  importExport: {
    pickImportFile(): Promise<string | null>
    pickExportPath(defaultFileName: string): Promise<string | null>
    importRoster(filePath: string, classId?: string): Promise<RosterImportResult>
    exportGradebook(classId: string, filePath: string): Promise<void>
    /** A course's Final grades sheet (every term + combined) and each term's gradebook. */
    exportCourseGradeSheet(courseGroupId: string, filePath: string): Promise<void>
    exportAttendance(classId: string, filePath: string): Promise<void>
    exportHomeworkSubmissions(
      homeworkAssignmentId: string,
      classId: string,
      filePath: string
    ): Promise<void>
  }
  print: {
    printStudentReport(
      studentId: string,
      classId: string,
      suggestedFileName: string
    ): Promise<{ saved: boolean; filePath?: string }>
  }
  standards: {
    list(): Promise<Standard[]>
    create(input: CreateStandardInput): Promise<Standard>
    update(id: string, patch: UpdateStandardInput): Promise<Standard>
    remove(id: string): Promise<void>
  }
  rubrics: {
    list(): Promise<RubricWithCriteria[]>
    get(id: string): Promise<RubricWithCriteria | undefined>
    create(input: CreateRubricInput): Promise<RubricWithCriteria>
    update(id: string, input: UpdateRubricInput): Promise<RubricWithCriteria>
    remove(id: string): Promise<void>
  }
  rubricScores: {
    list(assessmentId: string, studentId: string): Promise<RubricScore[]>
    save(input: SaveRubricScoresInput): Promise<{ pointsEarned: number }>
  }
  homeworkRubricScores: {
    list(homeworkAssignmentId: string, studentId: string): Promise<HomeworkRubricScore[]>
    save(input: SaveHomeworkRubricScoresInput): Promise<{ pointsEarned: number; maxPoints: number }>
  }
  homeworkQuestions: {
    list(homeworkAssignmentId: string): Promise<HomeworkQuestion[]>
    replace(homeworkAssignmentId: string, questions: DraftHomeworkQuestion[]): Promise<void>
  }
  auditLog: {
    list(filter?: { studentId?: string; classId?: string }): Promise<AuditLogEntry[]>
  }
  studentLogEntries: {
    listByStudent(studentId: string): Promise<StudentLogEntry[]>
    create(input: CreateStudentLogEntryInput): Promise<StudentLogEntry>
    update(id: string, patch: UpdateStudentLogEntryInput): Promise<StudentLogEntry>
    remove(id: string): Promise<void>
    listParentCommunications(): Promise<ParentCommunicationEntry[]>
  }
  lessonResources: {
    list(): Promise<LessonResource[]>
    create(input: CreateLessonResourceInput): Promise<LessonResource>
    update(id: string, patch: UpdateLessonResourceInput): Promise<LessonResource>
    remove(id: string): Promise<void>
    pickFile(): Promise<string | null>
    openPath(filePath: string): Promise<void>
    openExternal(url: string): Promise<void>
  }
  notebook: {
    indexResource(resourceId: string): Promise<number>
    indexAll(): Promise<number>
    ask(question: string, resourceIds: string[] | null): Promise<NotebookAnswer>
    draftStudyGuide(resourceId: string): Promise<string>
    /** Returns how many cards/questions were saved. */
    draftPracticeSet(resourceId: string, kind: 'flashcards' | 'quiz'): Promise<number>
    clearPracticeSet(resourceId: string, kind: 'flashcards' | 'quiz'): Promise<void>
  }
  courseGroups: {
    list(): Promise<CourseGroup[]>
    create(input: CreateCourseGroupInput): Promise<CourseGroup>
    rename(id: string, name: string): Promise<CourseGroup>
    remove(id: string): Promise<void>
    getComposite(courseGroupId: string): Promise<StudentCompositeGrade[]>
  }
  seatAssignments: {
    listByClass(classId: string): Promise<SeatAssignment[]>
    assignSeat(classId: string, studentId: string, row: number, col: number): Promise<void>
    unassignSeat(classId: string, studentId: string): Promise<void>
    clear(classId: string): Promise<void>
  }
  assignmentSubmissions: {
    listByAssessment(assessmentId: string): Promise<AssignmentSubmission[]>
    listByClass(classId: string): Promise<AssignmentSubmission[]>
    pickFile(): Promise<string | null>
    upsert(input: UpsertAssignmentSubmissionInput): Promise<AssignmentSubmission>
    remove(id: string): Promise<void>
    openPath(filePath: string): Promise<void>
  }
  exitTickets: {
    getByClass(classId: string): Promise<ExitTicket | undefined>
    upsert(input: UpsertExitTicketInput): Promise<ExitTicket>
    setOpen(id: string, isOpen: boolean): Promise<ExitTicket>
    listResponses(exitTicketId: string): Promise<ExitTicketResponse[]>
    clearResponses(exitTicketId: string): Promise<void>
    getServerInfo(): Promise<ExitTicketServerInfo>
    getQrDataUrl(url: string): Promise<string>
  }
  ai: {
    draftLessonPlan(input: DraftLessonPlanInput): Promise<DraftedLessonPlan>
    draftReportComment(input: DraftReportCommentInput): Promise<string>
    testConnection(config: AiConnectionConfig): Promise<AiConnectionTestResult>
  }
  homeworkAssignments: {
    listAll(): Promise<HomeworkAssignmentWithClass[]>
    listByClass(classId: string): Promise<HomeworkAssignment[]>
    create(input: CreateHomeworkAssignmentInput): Promise<HomeworkAssignment>
    update(id: string, patch: UpdateHomeworkAssignmentInput): Promise<HomeworkAssignment>
    remove(id: string): Promise<void>
    listSubmissions(
      homeworkAssignmentId: string,
      classId: string
    ): Promise<HomeworkSubmissionWithStudent[]>
    setSubmissionStatus(input: SetHomeworkSubmissionStatusInput): Promise<HomeworkSubmission>
    pickFile(): Promise<string | null>
    openPath(filePath: string): Promise<string>
    setSubmissionGrade(input: SetHomeworkSubmissionGradeInput): Promise<HomeworkSubmission>
    setSubmissionPortfolio(input: SetHomeworkSubmissionPortfolioInput): Promise<void>
    openSubmissionFile(
      homeworkAssignmentId: string,
      studentId: string,
      fileName: string
    ): Promise<string>
    /** AI-proposed feedback for one submission. Saves nothing. */
    draftFeedback(homeworkAssignmentId: string, studentId: string): Promise<FeedbackDraft>
  }
  portalJoinLinks: {
    overview(classId: string): Promise<PortalJoinLinksOverview>
    createClassLink(classId: string): Promise<PortalJoinLink>
    turnOffClassLink(classId: string): Promise<void>
    createStudentLink(classId: string, studentId: string): Promise<PortalJoinLink>
  }
  portalInvites: {
    createBatch(input: CreatePortalInviteBatchInput): Promise<PortalInviteBatchWithInvites>
    listBatchesByClass(classId: string): Promise<PortalInviteBatchWithInvites[]>
    getBatch(batchId: string): Promise<PortalInviteBatchWithInvites | null>
    revoke(inviteId: string): Promise<void>
    printBatch(
      batchId: string,
      suggestedFileName: string
    ): Promise<{ saved: boolean; filePath?: string }>
  }
  portalSync: {
    publish(): Promise<PublishResult>
    pullSubmissions(): Promise<number>
    aiActivity(studentId: string, homeworkId: string | null): Promise<PortalAiInteraction[]>
    /** Whether anything has changed here since the last publish. */
    status(): Promise<PublishStatus>
  }
  portalProfiles: {
    /** The student's Portal profile as shared with the teacher, or null if they haven't made one. */
    get(studentId: string): Promise<PortalStudentProfile | null>
  }
  portalMessages: {
    listThreads(): Promise<PortalMessageThread[]>
    send(accountId: string, body: string): Promise<void>
    markRead(accountId: string): Promise<void>
    translate(messageId: string, targetLang: string): Promise<string>
  }
  classPosts: {
    list(): Promise<ClassPost[]>
    create(classId: string, body: string, imagePath: string | null): Promise<void>
    remove(id: string): Promise<void>
    pickImage(): Promise<string | null>
  }
  digest: {
    sendNow(): Promise<{
      sent: number
      total: number
      errors: { username: string; error: string }[]
    }>
  }
  portalAccounts: {
    /** Sets a new password on a student/family Portal account and signs out all of its
     * existing sessions. Only works for accounts linked to this teacher's students. */
    resetPassword(username: string, newPassword: string): Promise<void>
    /** Students who asked for a reset from the login page. Empty without a Portal. */
    listResetRequests(): Promise<PortalResetRequest[]>
    /** Approve lets that student choose a new password on the device they asked from. */
    answerResetRequest(id: string, approve: boolean): Promise<void>
  }
}
