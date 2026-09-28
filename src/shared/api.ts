import type { ManagedBranding } from './branding'
import type { PhraseSuggestion } from './commentBank'
import type { PointSummaryItem } from './pointCategories'
import type { GroupChat } from './groupChats'
import type { UsagePing } from './usagePing'
import type { CssCheck } from './cssCheck'
// The typed shape of window.api, implemented by src/preload/index.ts and declared for
// the renderer in src/preload/index.d.ts. Keeping the contract here means both sides are
// checked against the same interface instead of preload's object literal being trusted.
import type { SetupProgress } from './setupChecklist'
import type { PortalAiInteraction } from './aiUsage'
import type { DigestPreview, PortalJoinLink, PortalJoinLinksOverview, PublishResult } from './types'
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
  AppUpdateStatus,
  SecurityStatus,
  BehaviourPoint,
  BehaviourTotal,
  ReportComment,
  TodayOverview,
  WatchListEntry,
  PortalResetRequest,
  PublishStatus,
  AttendanceWarning,
  BackupPreview,
  ClassScheduleSlot,
  ClassScheduleSlotWithClass,
  DeviceSyncStatus,
  DraftedLessonPlan,
  DraftLessonPlanInput,
  SuggestCommentPhrasesInput,
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
  StudentTimelineEvent,
  PostReplySlip,
  ReportCardDelivery,
  ReportCardSendProgress,
  ReportCardSendResult,
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
  StartNextTermForClassesInput,
  StartNextTermForClassesResult,
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
import type { ScoreImportRequest, ScoreImportResult, ScoreSheet } from './scoreImport'
import type { NewsletterFact, NewsletterStructure } from './newsletter'
import type { NewsletterSourceChoice, WeeklySummary } from './summaries'

/** What happened on the Portal when a student was deleted here. */
export type PortalRemoval = 'removed' | 'queued' | 'no-portal'

export interface EduBoardApi {
  students: {
    list(includeArchived?: boolean): Promise<Student[]>
    create(input: CreateStudentInput): Promise<Student>
    update(id: string, patch: UpdateStudentInput): Promise<Student>
    /** Also removes them from the Portal, or queues that for the next publish. */
    remove(id: string): Promise<PortalRemoval>
    /** Folds duplicateId into keepId here and on the Portal (login included). */
    merge(keepId: string, duplicateId: string): Promise<Student>
    /** Everything held about the student, saved as a JSON file the teacher chooses. */
    exportData(id: string): Promise<{ saved: boolean; filePath?: string }>
    /** Removes every record of the student for good (no backup, no audit trail). */
    erase(id: string): Promise<{ rowsErased: number; olderBackups: number; portal: PortalRemoval }>
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
    /** Next-term classes for several classes at once. */
    startNextTerm(input: StartNextTermForClassesInput): Promise<StartNextTermForClassesResult>
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
    /** Copies the week starting fromMonday to the week starting toMonday; returns the count. */
    copyWeek(classId: string, fromMonday: string, toMonday: string): Promise<number>
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
    /** For the update icon and badges; cheap, polled. Doesn't reach the internet. */
    appUpdateStatus(): Promise<AppUpdateStatus>
    /** The school pack installed for everyone on this computer, if any, and what it locks. */
    managedBranding(): Promise<ManagedBranding | null>
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
    /** Every table (except settings) as one .xlsx, a sheet each, to a file the teacher picks. */
    exportEverything(): Promise<{ saved: boolean; filePath?: string; sheets?: number }>
  }
  print: {
    printStudentReport(
      studentId: string,
      classId: string,
      suggestedFileName: string
    ): Promise<{ saved: boolean; filePath?: string }>
    /** Every active student's report card for the class in one PDF, a page each. */
    printClassReports(
      classId: string,
      suggestedFileName: string
    ): Promise<{ saved: boolean; filePath?: string }>
    /** A personalised parent letter per active student, from the letter template. */
    printClassLetters(
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
  today: {
    /** Today's lessons from the timetable, and parent follow-ups due. */
    overview(): Promise<TodayOverview>
    /** Students below the pass mark, falling, or with repeated concerns. */
    watchList(): Promise<WatchListEntry[]>
  }
  reportComments: {
    list(classId: string): Promise<ReportComment[]>
    set(classId: string, studentId: string, text: string): Promise<void>
  }
  behaviourPoints: {
    add(input: {
      classId: string
      studentId: string
      points: number
      reason?: string | null
      category?: string | null
    }): Promise<BehaviourPoint>
    totals(classId: string, weekStartIso: string): Promise<BehaviourTotal[]>
    undoLast(classId: string): Promise<BehaviourPoint | null>
    /** A student's points in the class, by category (for the report card). */
    summary(classId: string, studentId: string): Promise<PointSummaryItem[]>
  }
  schoolPack: {
    /** Saves this computer's school-wide settings and terms as a school pack file. */
    export(): Promise<{ saved: boolean; filePath?: string }>
    /** Asks for a pack file and lists what importing it would change (nothing applied). */
    preview(): Promise<{ filePath: string; changes: string[] } | null>
    /** Applies the pack at filePath (read and checked again, not trusted from preview). */
    apply(filePath: string): Promise<{ changes: string[]; reload?: boolean }>
    /** Asks for a .css file and saves it, cleaned, as the school stylesheet. */
    /** Loads a school stylesheet and says what it changes, or null if none was chosen. */
    importCss(): Promise<CssCheck | null>
    /** Saves an example stylesheet with every EduBoard colour, to edit and load. */
    saveExampleCss(): Promise<boolean>
  }
  coursePack: {
    /** Chooses and validates a curriculum pack without changing the database. */
    preview(): Promise<{
      filePath: string
      id: string
      name: string
      description: string | null
      subject: string | null
      terms: { key: string; name: string; schoolYear: string; startDate: string | null }[]
      counts: {
        standards: number
        rubrics: number
        resources: number
        studentFields: number
        assessments: number
        homework: number
        lessons: number
      }
    } | null>
    /** Backs up first, then installs the pack into the explicitly mapped existing classes. */
    apply(
      filePath: string,
      termBindings: Record<string, string>,
      firstClassDates?: Record<string, string>
    ): Promise<{
      courseGroupId: string
      created: Record<string, number>
      reused: Record<string, number>
    }>
  }
  security: {
    status(): Promise<SecurityStatus>
    /** Password or recovery key. */
    unlock(secret: string): Promise<{ ok: boolean; retryInSeconds: number }>
    lock(): Promise<void>
    /** Encrypts the database; the recovery key is returned once, to show the teacher. */
    enable(password: string): Promise<{ recoveryKey: string }>
    changePassword(current: string, next: string): Promise<void>
    disable(password: string): Promise<void>
    /** Backups (here and in the second folder) made before protection was on. */
    unprotectedBackups(): Promise<string[]>
    deleteUnprotectedBackups(): Promise<number>
  }
  exitTickets: {
    getByClass(classId: string): Promise<ExitTicket | undefined>
    upsert(input: UpsertExitTicketInput): Promise<ExitTicket>
    /** `autoCloseMinutes`: an opened session closes itself after that long (null: never). */
    setOpen(id: string, isOpen: boolean, autoCloseMinutes?: number | null): Promise<ExitTicket>
    listResponses(exitTicketId: string): Promise<ExitTicketResponse[]>
    clearResponses(exitTicketId: string): Promise<void>
    getServerInfo(): Promise<ExitTicketServerInfo>
    getQrDataUrl(url: string): Promise<string>
  }
  ai: {
    draftLessonPlan(input: DraftLessonPlanInput): Promise<DraftedLessonPlan>
    /** A few short phrases for a report comment, each tied to the data it rests on.
     * Never a whole comment. Needs the internet. */
    suggestCommentPhrases(input: SuggestCommentPhrasesInput): Promise<PhraseSuggestion[]>
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
  /** The sample school: EduBoard reopened on made-up classes in a separate database. */
  sampleSchool: {
    /** Whether EduBoard is showing the sample school right now. */
    status(): Promise<boolean>
    /** Reopens EduBoard in the sample school; `fresh` starts it over. */
    open(fresh?: boolean): Promise<void>
    /** Reopens EduBoard on the teacher's own classes. */
    leave(): Promise<void>
  }
  /** One student's record in date order, across all their classes. */
  studentTimeline: {
    get(studentId: string): Promise<StudentTimelineEvent[]>
  }
  /** Scores from a spreadsheet into a class's gradebook: read the file for the preview,
   * then write what the teacher confirmed. */
  scoreImport: {
    read(filePath: string, sheetIndex?: number): Promise<ScoreSheet>
    apply(request: ScoreImportRequest): Promise<ScoreImportResult>
  }
  /** Report cards sent privately to families on the Portal (one PDF per student). */
  reportCards: {
    /** Makes each active student's report card and sends it under this title; sending
     * the same title again replaces it. */
    send(classId: string, title: string): Promise<ReportCardSendResult>
    /** How far a send has got, or null when none is running. */
    progress(): Promise<ReportCardSendProgress | null>
    list(classId: string): Promise<ReportCardDelivery[]>
    withdraw(classId: string, title: string): Promise<number>
  }
  classPosts: {
    list(): Promise<ClassPost[]>
    create(
      classId: string,
      body: string,
      imagePath: string | null,
      replySlip?: PostReplySlip | null
    ): Promise<void>
    remove(id: string): Promise<void>
    /** Messages every family that hasn't answered the post's reply slip; how many. */
    remind(id: string): Promise<number>
    pickImage(): Promise<string | null>
  }
  digest: {
    sendNow(): Promise<{
      sent: number
      total: number
      errors: { username: string; error: string }[]
    }>
    /** What each family would get this week, from the Portal. */
    preview(): Promise<DigestPreview[]>
    /** Adds a newsletter at the top of the digest until `until` (empty text clears it). */
    setNewsletter(text: string, until: string | null): Promise<void>
  }
  weeklySummary: {
    /** The teacher's own weekly summary, as data and as the HTML that's shown and sent. */
    get(): Promise<{ summary: WeeklySummary; html: string }>
    print(): Promise<{ saved: boolean; filePath?: string }>
    /** Emails it to the teacher's own address; returns that address. */
    email(): Promise<string>
  }
  errorReport: {
    /** Version, system and recent errors, as text to copy and send (Settings → Help). */
    get(): Promise<string>
    /** The last few errors shown, newest first. */
    recent(): Promise<{ at: string; code: string; message: string; ref?: string }[]>
    /** Logs a screen that failed to draw; returns the reference to show. */
    logWindowError(input: { message: string; stack?: string; where?: string }): Promise<string>
    /** Shows the error log file in the file manager. */
    openFolder(): Promise<void>
  }
  usagePing: {
    /** Exactly what the anonymous weekly ping sends (the id is blank while it's off). */
    preview(): Promise<UsagePing>
  }
  groupChats: {
    /** Posts text into a saved DingTalk / WeCom group (needs internet). */
    send(groupId: string, text: string, title: string): Promise<void>
    /** Sends a short "connected" message to a group being set up, before it's saved. */
    test(group: Pick<GroupChat, 'webhook' | 'secret'>): Promise<void>
  }
  office: {
    /** Saves a Word document (asks where). Letters and report cards are for a class,
     * a lesson plan by its id, a newsletter from its text. */
    word(
      what:
        | { kind: 'letters' | 'reportCards'; classId: string }
        | { kind: 'lessonPlan'; planId: string }
        | { kind: 'newsletter'; text: string }
    ): Promise<{ saved: boolean; filePath?: string }>
    /** Saves a lesson plan as a starter PowerPoint deck (asks where). */
    slides(planId: string): Promise<{ saved: boolean; filePath?: string }>
  }
  newsletter: {
    facts(choice: NewsletterSourceChoice): Promise<NewsletterFact[]>
    draft(input: {
      structure: NewsletterStructure
      customSections: string[]
      facts: NewsletterFact[]
      notes: string
    }): Promise<string>
    /** The newsletter being written, kept with this school's data (so the sample school
     * and password protection keep it apart like everything else). */
    savedDraft(): Promise<string>
    saveDraft(text: string): Promise<void>
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
