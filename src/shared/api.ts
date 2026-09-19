// The typed shape of window.api, implemented by src/preload/index.ts and declared for
// the renderer in src/preload/index.d.ts. Keeping the contract here means both sides are
// checked against the same interface instead of preload's object literal being trusted.
import type {
  AppSettings,
  Assessment,
  AttendanceRecord,
  AttendanceSummary,
  BackupInfo,
  BackupPreview,
  DeviceSyncStatus,
  ScoreHistoryEntry,
  ClassReport,
  ClassRosterRow,
  ClassSection,
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
  UpsertExitTicketInput
} from './inputs'
import type { RosterImportResult } from './importExportTypes'

export interface EduBoardApi {
  students: {
    list(includeArchived?: boolean): Promise<Student[]>
    create(input: CreateStudentInput): Promise<Student>
    update(id: string, patch: UpdateStudentInput): Promise<Student>
    remove(id: string): Promise<void>
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
  lessonPlans: {
    listByClass(classId: string): Promise<LessonPlan[]>
    listUpcoming(fromDate: string, limit?: number): Promise<LessonPlan[]>
    create(input: CreateLessonPlanInput): Promise<LessonPlan>
    update(id: string, patch: UpdateLessonPlanInput): Promise<LessonPlan>
    remove(id: string): Promise<void>
  }
  reports: {
    dashboardStats(): Promise<DashboardStats>
    classRoster(classId: string): Promise<ClassRosterRow[]>
    classReport(classId: string): Promise<ClassReport | null>
    studentClassGrade(studentId: string, classId: string): Promise<StudentClassGrade | null>
    studentAttendanceSummary(studentId: string, classId: string): Promise<AttendanceSummary>
  }
  settings: {
    get(): Promise<AppSettings>
    update(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  backup: {
    create(): Promise<BackupInfo>
    list(): Promise<BackupInfo[]>
    preview(filePath: string): Promise<BackupPreview>
    restore(filePath: string): Promise<void>
    revealFolder(): Promise<void>
  }
  deviceSync: {
    check(): Promise<DeviceSyncStatus>
  }
  importExport: {
    pickImportFile(): Promise<string | null>
    pickExportPath(defaultFileName: string): Promise<string | null>
    importRoster(filePath: string, classId?: string): Promise<RosterImportResult>
    exportGradebook(classId: string, filePath: string): Promise<void>
    exportAttendance(classId: string, filePath: string): Promise<void>
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
  exitTickets: {
    getByClass(classId: string): Promise<ExitTicket | undefined>
    upsert(input: UpsertExitTicketInput): Promise<ExitTicket>
    setOpen(id: string, isOpen: boolean): Promise<ExitTicket>
    listResponses(exitTicketId: string): Promise<ExitTicketResponse[]>
    clearResponses(exitTicketId: string): Promise<void>
    getServerInfo(): Promise<ExitTicketServerInfo>
    getQrDataUrl(url: string): Promise<string>
  }
}
