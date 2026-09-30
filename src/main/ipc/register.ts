import { AppError } from '@shared/errorCodes'
import { isSampleSchool, leaveSampleSchool, openSampleSchool } from '../services/sampleSchool'
import { applyShortcutBranding } from '../services/shortcutBranding'
import { studentTimeline } from '../services/studentTimeline'
import { applyScoreImport, readScoreSheet } from '../services/scoreImport'
import type { ScoreImportRequest } from '@shared/scoreImport'
import { reportCardSendProgress, sendReportCards } from '../services/reportCardDelivery'
import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { IpcChannels } from '@shared/ipc'
import type {
  PostReplySlip,
  PortalJoinLink,
  AiConnectionConfig,
  AiMaterialKind,
  DraftLessonPlanInput,
  SuggestCommentPhrasesInput
} from '@shared/types'
import { AI_MATERIAL_KINDS } from '@shared/types'

import * as studentsRepo from '../repositories/students'
import * as portalJoinLinksRepo from '../repositories/portalJoinLinks'
import { normalizePortalUrl } from '@shared/portalUrl'
import * as termsRepo from '../repositories/terms'
import { lockedBrandingKeys, managedBranding } from '../services/managedSchoolPack'
import { withoutLocked } from '@shared/branding'
import * as classesRepo from '../repositories/classes'
import * as newTermClassRepo from '../repositories/newTermClass'
import * as gradeCategoriesRepo from '../repositories/gradeCategories'
import * as enrollmentsRepo from '../repositories/enrollments'
import * as assessmentsRepo from '../repositories/assessments'
import * as scoresRepo from '../repositories/scores'
import * as attendanceRepo from '../repositories/attendanceRecords'
import * as lessonPlansRepo from '../repositories/lessonPlans'
import * as scheduleSlotsRepo from '../repositories/classScheduleSlots'
import * as settingsRepo from '../repositories/settingsRepo'
import {
  getAppUpdateInfo,
  getAppUpdateProgress,
  getAppUpdateStatus,
  installAppUpdate
} from '../services/selfUpdate'
import * as standardsRepo from '../repositories/standards'
import * as rubricsRepo from '../repositories/rubrics'
import * as coursePacksRepo from '../repositories/coursePacks'
import * as rubricScoresRepo from '../repositories/rubricScores'
import * as homeworkRubricScoresRepo from '../repositories/homeworkRubricScores'
import * as homeworkQuestionsRepo from '../repositories/homeworkQuestions'
import * as auditLogRepo from '../repositories/auditLog'
import * as studentLogEntriesRepo from '../repositories/studentLogEntries'
import * as lessonResourcesRepo from '../repositories/lessonResources'
import * as resourceChunksRepo from '../repositories/resourceChunks'
import {
  indexResource,
  askNotebook,
  draftStudyGuide,
  draftPracticeSet,
  clearPracticeSet
} from '../services/notebookService'
import * as assignmentSubmissionsRepo from '../repositories/assignmentSubmissions'
import * as seatAssignmentsRepo from '../repositories/seatAssignments'
import * as courseGroupsRepo from '../repositories/courseGroups'
import { getCourseGroupComposite } from '../services/compositeGrades'
import * as exitTicketsRepo from '../repositories/exitTickets'
import {
  closeAttendanceCheckIn,
  closeClassroomHub,
  getAttendanceCheckInStatus,
  getClassroomHubStatus,
  getExitTicketServerInfo,
  openAttendanceCheckIn,
  openClassroomHub,
  startExitTicketServer
} from '../services/exitTicketServer'
import QRCode from 'qrcode'
import * as reportsService from '../services/reports'
import * as aiService from '../services/aiService'
import * as homeworkRepo from '../repositories/homeworkAssignments'
import * as portalInvitesRepo from '../repositories/portalInvites'
import {
  publishToPortal,
  pullSubmissionsFromPortal,
  getStudentsWithPortalAccounts,
  getStudentAiActivity,
  getReviewStats,
  pushSubmissionGrade,
  pushSubmissionPortfolio,
  downloadSubmissionFile,
  listMessageThreads,
  sendTeacherMessage,
  markMessageThreadRead,
  translateMessage,
  listClassPosts,
  listReportCardDeliveries,
  withdrawReportCards,
  createClassPost,
  deleteClassPost,
  remindUnrepliedFamilies,
  sendDigestNow,
  resetPortalPassword,
  getPortalProfile,
  mergeStudentsEverywhere,
  previewDigest,
  setDigestNewsletter,
  emailTeacherSummary,
  removeStudentFromPortal,
  listPortalResetRequests,
  answerPortalResetRequest,
  getPublishStatus
} from '../services/portalSyncService'
import * as backupService from '../services/backup'
import * as security from '../services/security'
import * as behaviourPointsRepo from '../repositories/behaviourPoints'
import * as reportCommentsRepo from '../repositories/reportComments'
import { getTodayOverview, getWatchList } from '../services/today'
import { getCompetencyMatrix } from '../services/competencyMatrix'
import { getCurriculumMap } from '../services/curriculumMap'
import { eraseStudent, exportStudentData } from '../services/studentErase'
import { saveUiPrefs } from '../i18n'
import { resolveAttendanceCodes } from '@shared/attendanceCodes'
import {
  MAX_CSS_CHARS,
  makeSchoolPack,
  parseSchoolPack,
  planSchoolPack,
  sanitizeCss
} from '@shared/schoolPack'
import { parseCoursePack } from '@shared/coursePack'
import { isSafeExternalUrl } from '@shared/externalUrl'
import { checkCss, exampleStylesheet } from '@shared/cssCheck'
import { getDeviceSyncStatus } from '../services/deviceSync'
import * as importExportService from '../services/importExport'
import { resolveBackupsDir } from '../db/path'
import { isSafeToOpen } from '../services/untrustedFiles'
import { draftSubmissionFeedback } from '../services/feedbackDraft'
import { getSetupProgress } from '../services/setupProgress'
import { applyWindowIcon, createPrintWindow, loadAppRoute, waitForPrintReady } from '../windows'
import { tr, uiLanguage } from '@shared/i18n'
import { getWeeklySummary, weeklySummaryHtml } from '../services/weeklySummary'
import { draftNewsletter, gatherNewsletterFacts } from '../services/newsletterService'
import { sendToGroupChat, sendToSavedGroupChat } from '../services/groupChat'
import { usagePingPreview, usagePingSettingChanged } from '../services/usagePing'
import {
  errorLogPath,
  errorReportText,
  logWindowError,
  recentErrors,
  toWindowError
} from '../services/errorLog'
import type { NewsletterFact, NewsletterStructure } from '@shared/newsletter'
import type { NewsletterSourceChoice } from '@shared/summaries'
import {
  lessonPlanDocx,
  lessonPlanPptx,
  lettersDocx,
  newsletterDocx,
  reportCardsDocx
} from '../services/officeExport'

/** The newsletter being written (Newsletter page), kept in the database with the rest of
 * this school's data. */
const NEWSLETTER_DRAFT_KEY = 'newsletter_draft'

/** The school's name and logo on the Windows shortcuts; the sample school leaves them be. */
function brandShortcuts(): void {
  if (!isSampleSchool()) applyShortcutBranding(settingsRepo.getSettings())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic IPC dispatch boundary; each handler below is fully typed
function handle<T>(channel: string, fn: (event: IpcMainInvokeEvent, ...args: any[]) => T): void {
  ipcMain.handle(channel, async (event, ...args) => {
    // Behind the lock screen the window may only ask about, and try to open, the lock
    // (and report a screen that failed to draw).
    if (
      !channel.startsWith('security:') &&
      channel !== IpcChannels.errorReport.logWindowError &&
      security.isLocked()
    ) {
      throw toWindowError(new AppError('EB-0001', tr('EduBoard is locked.')), channel)
    }
    try {
      return await fn(event, ...args)
    } catch (err) {
      // Every error reaches the window with its code, and unexpected ones are logged.
      throw toWindowError(err, channel)
    }
  })
}

/** The hidden print window created for printToPDF is never a valid dialog owner (it's
 * never shown), so a save dialog with no parent has nothing to anchor to — on Windows in
 * particular, that can leave it opened behind the app with no taskbar entry, looking like
 * it never appeared at all. Anchoring to the actual visible window, and stealing focus
 * first, makes sure it comes to the front. */
async function showSaveDialogOnTop(
  options: Electron.SaveDialogOptions
): ReturnType<typeof dialog.showSaveDialog> {
  const owner = BrowserWindow.getAllWindows().find((w) => w.isVisible())
  if (owner) owner.focus()
  return owner ? dialog.showSaveDialog(owner, options) : dialog.showSaveDialog(options)
}

/** Renders a print route in a hidden window and saves it as a PDF where the teacher
 * chooses. A whole class loads many students' data, so it may take a while to be ready. */
async function printRouteToPdf(
  route: string,
  suggestedFileName: string
): Promise<{ saved: boolean; filePath?: string }> {
  const win = createPrintWindow()
  try {
    await loadAppRoute(win, route)
    await waitForPrintReady(win, 60_000)
    const pdfBuffer = await win.webContents.printToPDF({ printBackground: true })
    const { canceled, filePath } = await showSaveDialogOnTop({
      defaultPath: suggestedFileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return { saved: false }
    await writeFile(filePath, pdfBuffer)
    return { saved: true, filePath }
  } finally {
    win.destroy()
  }
}

export function registerIpcHandlers(): void {
  // --- Students -------------------------------------------------------------------
  handle(IpcChannels.students.list, (_e, includeArchived?: boolean) =>
    studentsRepo.listStudents(includeArchived)
  )
  handle(IpcChannels.students.create, (_e, input: studentsRepo.CreateStudentInput) =>
    studentsRepo.createStudent(input)
  )
  handle(IpcChannels.students.update, (_e, id: string, patch: studentsRepo.UpdateStudentInput) =>
    studentsRepo.updateStudent(id, patch)
  )
  handle(IpcChannels.students.remove, (_e, id: string) => {
    // A recovery point taken right before the one truly destructive action in this
    // app — if a teacher deletes the wrong student, or a bug wipes more than intended,
    // this backup (plus the audit trail's 12-month soft-delete window) is the way back.
    backupService.createBackup()
    studentsRepo.deleteStudent(id)
    return removeStudentFromPortal(id)
  })
  handle(IpcChannels.students.exportData, async (_e, id: string) => {
    const data = exportStudentData(id)
    const name = `${data.student.first_name}-${data.student.last_name}`.replace(
      /[^\p{L}\p{N}-]+/gu,
      '_'
    )
    const { canceled, filePath } = await showSaveDialogOnTop({
      defaultPath: `${name}-EduBoard-data.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return { saved: false }
    await writeFile(filePath, JSON.stringify(data, null, 2))
    return { saved: true, filePath }
  })
  handle(IpcChannels.students.erase, async (_e, id: string) => {
    const result = eraseStudent(id)
    return { ...result, portal: await removeStudentFromPortal(id) }
  })
  handle(IpcChannels.students.merge, (_e, keepId: string, duplicateId: string) => {
    // Merging removes a student record too, so it gets the same recovery point.
    backupService.createBackup()
    return mergeStudentsEverywhere(keepId, duplicateId)
  })

  // --- Terms ------------------------------------------------------------------------
  handle(IpcChannels.terms.list, () => termsRepo.listTerms())
  handle(IpcChannels.terms.create, (_e, input: termsRepo.CreateTermInput) =>
    termsRepo.createTerm(input)
  )
  handle(IpcChannels.terms.update, (_e, id: string, patch: termsRepo.UpdateTermInput) =>
    termsRepo.updateTerm(id, patch)
  )
  handle(IpcChannels.terms.remove, (_e, id: string) => termsRepo.deleteTerm(id))

  // --- Classes ------------------------------------------------------------------------
  handle(IpcChannels.classes.list, (_e, includeArchived?: boolean) =>
    classesRepo.listClasses(includeArchived)
  )
  handle(IpcChannels.classes.create, (_e, input: classesRepo.CreateClassInput) =>
    classesRepo.createClass(input)
  )
  handle(IpcChannels.classes.update, (_e, id: string, patch: classesRepo.UpdateClassInput) => {
    const updated = classesRepo.updateClass(id, patch)
    // A grid shrink can strand students at now-out-of-bounds seats — invisible on the
    // grid and absent from "Unseated" alike, since their seat_assignments row is still
    // there. Only relevant when the seating dimensions actually changed.
    if (patch.seatingRows !== undefined || patch.seatingCols !== undefined) {
      seatAssignmentsRepo.pruneOutOfBoundsSeats(id, updated.seatingRows, updated.seatingCols)
    }
    return updated
  })
  handle(IpcChannels.classes.remove, (_e, id: string) => classesRepo.deleteClass(id))
  handle(
    IpcChannels.classes.duplicateForNewTerm,
    (_e, id: string, input: newTermClassRepo.DuplicateClassForNewTermInput) =>
      newTermClassRepo.duplicateClassForNewTerm(id, input)
  )
  handle(
    IpcChannels.classes.startNextTerm,
    (_e, input: newTermClassRepo.StartNextTermForClassesInput) => {
      if (
        !Array.isArray(input?.classIds) ||
        !input.classIds.every((id) => typeof id === 'string')
      ) {
        throw new AppError('EB-0004', tr('Choose the classes to carry on.'))
      }
      // Makes many classes at once, so the same recovery point as other big changes.
      backupService.createBackup()
      return newTermClassRepo.startNextTermForClasses(input)
    }
  )

  // --- Grade categories --------------------------------------------------------------
  handle(IpcChannels.gradeCategories.listByClass, (_e, classId: string) =>
    gradeCategoriesRepo.listGradeCategories(classId)
  )
  handle(
    IpcChannels.gradeCategories.create,
    (_e, input: gradeCategoriesRepo.CreateGradeCategoryInput) =>
      gradeCategoriesRepo.createGradeCategory(input)
  )
  handle(
    IpcChannels.gradeCategories.update,
    (_e, id: string, patch: gradeCategoriesRepo.UpdateGradeCategoryInput) =>
      gradeCategoriesRepo.updateGradeCategory(id, patch)
  )
  handle(IpcChannels.gradeCategories.remove, (_e, id: string) =>
    gradeCategoriesRepo.deleteGradeCategory(id)
  )

  // --- Enrollments ---------------------------------------------------------------------
  handle(IpcChannels.enrollments.listByClass, (_e, classId: string) =>
    enrollmentsRepo.listEnrollmentsByClass(classId)
  )
  handle(IpcChannels.enrollments.listByStudent, (_e, studentId: string) =>
    enrollmentsRepo.listEnrollmentsByStudent(studentId)
  )
  handle(IpcChannels.enrollments.enroll, (_e, input: enrollmentsRepo.CreateEnrollmentInput) =>
    enrollmentsRepo.enrollStudent(input)
  )
  handle(IpcChannels.enrollments.updateStatus, (_e, id: string, status: string) =>
    enrollmentsRepo.updateEnrollmentStatus(id, status as never)
  )
  handle(IpcChannels.enrollments.unenroll, (_e, studentId: string, classId: string) =>
    enrollmentsRepo.unenrollStudent(studentId, classId)
  )

  // --- Assessments -----------------------------------------------------------------------
  handle(IpcChannels.assessments.listByClass, (_e, classId: string) =>
    assessmentsRepo.listAssessmentsByClass(classId)
  )
  handle(IpcChannels.assessments.create, (_e, input: assessmentsRepo.CreateAssessmentInput) =>
    assessmentsRepo.createAssessment(input)
  )
  handle(
    IpcChannels.assessments.update,
    (_e, id: string, patch: assessmentsRepo.UpdateAssessmentInput) =>
      assessmentsRepo.updateAssessment(id, patch)
  )
  handle(IpcChannels.assessments.remove, (_e, id: string) => assessmentsRepo.deleteAssessment(id))

  // --- Scores -----------------------------------------------------------------------------
  handle(IpcChannels.scores.listByAssessment, (_e, assessmentId: string) =>
    scoresRepo.listScoresByAssessment(assessmentId)
  )
  handle(IpcChannels.scores.listByClass, (_e, classId: string) =>
    scoresRepo.listScoresByClass(classId)
  )
  handle(IpcChannels.scores.listByStudentAndClass, (_e, studentId: string, classId: string) =>
    scoresRepo.listScoresByStudentAndClass(studentId, classId)
  )
  handle(IpcChannels.scores.upsert, (_e, input: scoresRepo.UpsertScoreInput) =>
    scoresRepo.upsertScore(input)
  )
  handle(IpcChannels.scores.upsertBulk, (_e, inputs: scoresRepo.UpsertScoreInput[]) =>
    scoresRepo.upsertScoresBulk(inputs)
  )
  handle(IpcChannels.scores.history, (_e, assessmentId: string, studentId: string) =>
    scoresRepo.listScoreHistory(assessmentId, studentId)
  )
  handle(IpcChannels.scores.attempts, (_e, assessmentId: string, studentId: string) =>
    scoresRepo.listScoreAttempts(assessmentId, studentId)
  )
  handle(IpcChannels.scores.addAttempt, (_e, input: scoresRepo.AddScoreAttemptInput) =>
    scoresRepo.addScoreAttempt(input)
  )

  // --- Attendance -----------------------------------------------------------------------
  handle(IpcChannels.attendance.listByClass, (_e, classId: string) =>
    attendanceRepo.listAttendanceByClass(classId)
  )
  handle(IpcChannels.attendance.listByStudentAndClass, (_e, studentId: string, classId: string) =>
    attendanceRepo.listAttendanceByStudentAndClass(studentId, classId)
  )
  // Only codes this school has: a built-in status or one of its own.
  const checkAttendanceCode = (status: unknown): void => {
    const known = resolveAttendanceCodes(settingsRepo.getSettings().attendanceCodes)
    if (!known.some((c) => c.id === status))
      throw new AppError('EB-0004', tr('That attendance code doesn’t exist.'))
  }
  handle(IpcChannels.attendance.mark, (_e, input: attendanceRepo.MarkAttendanceInput) => {
    checkAttendanceCode(input?.status)
    return attendanceRepo.markAttendance(input)
  })
  handle(IpcChannels.attendance.markBulk, (_e, inputs: attendanceRepo.MarkAttendanceInput[]) => {
    for (const input of inputs ?? []) checkAttendanceCode(input?.status)
    return attendanceRepo.markAttendanceBulk(inputs)
  })

  // --- Attendance QR check-in ----------------------------------------------------------------
  handle(IpcChannels.attendanceCheckIn.getStatus, (_e, classId: string) =>
    getAttendanceCheckInStatus(classId)
  )
  handle(IpcChannels.attendanceCheckIn.open, (_e, classId: string, date: string) => {
    startExitTicketServer()
    openAttendanceCheckIn(classId, date)
    return getAttendanceCheckInStatus(classId)
  })
  handle(IpcChannels.attendanceCheckIn.close, (_e, classId: string) =>
    closeAttendanceCheckIn(classId)
  )

  // --- Lesson plans -----------------------------------------------------------------------
  handle(IpcChannels.lessonPlans.listByClass, (_e, classId: string) =>
    lessonPlansRepo.listLessonPlansByClass(classId)
  )
  handle(IpcChannels.lessonPlans.listUpcoming, (_e, fromDate: string, limit?: number) =>
    lessonPlansRepo.listUpcomingLessonPlans(fromDate, limit)
  )
  handle(IpcChannels.lessonPlans.create, (_e, input: lessonPlansRepo.CreateLessonPlanInput) =>
    lessonPlansRepo.createLessonPlan(input)
  )
  handle(
    IpcChannels.lessonPlans.update,
    (_e, id: string, patch: lessonPlansRepo.UpdateLessonPlanInput) =>
      lessonPlansRepo.updateLessonPlan(id, patch)
  )
  handle(IpcChannels.lessonPlans.remove, (_e, id: string) => lessonPlansRepo.deleteLessonPlan(id))
  handle(
    IpcChannels.lessonPlans.copyWeek,
    (_e, classId: string, fromMonday: string, toMonday: string) => {
      const iso = /^\d{4}-\d{2}-\d{2}$/
      if (!iso.test(fromMonday) || !iso.test(toMonday))
        throw new AppError('EB-0004', tr('Invalid week'))
      return lessonPlansRepo.copyWeekOfPlans(String(classId), fromMonday, toMonday)
    }
  )
  handle(
    IpcChannels.lessonPlans.shiftPlanned,
    (_e, classId: string, fromDate: string, days: number) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !Number.isInteger(days)) {
        throw new AppError('EB-0004', tr('Invalid week'))
      }
      return lessonPlansRepo.shiftPlannedLessons(String(classId), fromDate, days)
    }
  )
  handle(IpcChannels.lessonPlans.resourceIds, (_e, lessonPlanId: string) =>
    lessonPlansRepo.listLessonResourceIds(String(lessonPlanId))
  )
  handle(IpcChannels.lessonPlans.setResources, (_e, lessonPlanId: string, resourceIds: string[]) =>
    lessonPlansRepo.setLessonResources(
      String(lessonPlanId),
      Array.isArray(resourceIds) ? resourceIds.map(String) : []
    )
  )

  // --- Schedule slots (Timetable) ------------------------------------------------------------
  handle(IpcChannels.scheduleSlots.listByClass, (_e, classId: string) =>
    scheduleSlotsRepo.listScheduleSlotsByClass(classId)
  )

  handle(IpcChannels.scheduleSlots.listAll, () => scheduleSlotsRepo.listAllScheduleSlots())
  handle(
    IpcChannels.scheduleSlots.create,
    (_e, input: scheduleSlotsRepo.CreateClassScheduleSlotInput) =>
      scheduleSlotsRepo.createScheduleSlot(input)
  )
  handle(
    IpcChannels.scheduleSlots.update,
    (_e, id: string, patch: scheduleSlotsRepo.UpdateClassScheduleSlotInput) =>
      scheduleSlotsRepo.updateScheduleSlot(id, patch)
  )
  handle(IpcChannels.scheduleSlots.remove, (_e, id: string) =>
    scheduleSlotsRepo.deleteScheduleSlot(id)
  )

  // --- Reports ------------------------------------------------------------------------------
  handle(IpcChannels.reports.dashboardStats, () => reportsService.getDashboardStats())
  handle(IpcChannels.reports.attendanceWarnings, () => reportsService.getAttendanceWarnings())
  handle(IpcChannels.reports.setupProgress, () => getSetupProgress())
  handle(IpcChannels.reports.classRoster, (_e, classId: string) =>
    reportsService.getClassRoster(classId)
  )
  handle(IpcChannels.reports.classReport, (_e, classId: string) =>
    reportsService.getClassReport(classId)
  )
  handle(IpcChannels.reports.studentClassGrade, (_e, studentId: string, classId: string) =>
    reportsService.getStudentClassGrade(studentId, classId)
  )
  handle(IpcChannels.reports.analyticsOverview, () => reportsService.getAnalyticsOverview())
  handle(IpcChannels.reports.studentAttendanceSummary, (_e, studentId: string, classId: string) =>
    reportsService.getStudentAttendanceSummary(studentId, classId)
  )
  handle(IpcChannels.reports.studentGradeTrend, (_e, studentId: string, classId: string) =>
    reportsService.getStudentGradeTrend(studentId, classId)
  )

  // --- Competency evidence ---------------------------------------------------------------
  handle(IpcChannels.competencies.matrix, (_e, classId: string) =>
    getCompetencyMatrix(String(classId))
  )
  handle(
    IpcChannels.curriculumMap.get,
    (_e, scopeType: 'courseGroup' | 'class', scopeId: string) => {
      if (scopeType !== 'courseGroup' && scopeType !== 'class') {
        throw new AppError('EB-0004', tr('Choose a course or a class for the curriculum map.'))
      }
      return getCurriculumMap(scopeType, String(scopeId))
    }
  )

  // --- Settings -----------------------------------------------------------------------------
  handle(IpcChannels.settings.get, () => settingsRepo.getSettings())
  handle(IpcChannels.settings.update, (_e, requested) => {
    // What the school set for everyone on this computer can't be changed here.
    const patch = requested ? withoutLocked(requested, lockedBrandingKeys()) : requested
    if (patch && 'uiLanguage' in patch) {
      saveUiPrefs({
        language: patch.uiLanguage === 'zh' || patch.uiLanguage === 'en' ? patch.uiLanguage : ''
      })
    }
    if (patch && 'terminology' in patch) saveUiPrefs({ terminology: patch.terminology ?? {} })
    const saved = settingsRepo.updateSettings(patch)
    if (patch && 'appDisplayName' in patch) saveUiPrefs({ appName: saved.appDisplayName })
    if (patch && 'schoolLogo' in patch) applyWindowIcon(saved.schoolLogo)
    if (patch && ('appDisplayName' in patch || 'schoolLogo' in patch)) brandShortcuts()
    if (patch && 'usagePing' in patch) usagePingSettingChanged(saved.usagePing === true)
    return saved
  })
  handle(IpcChannels.settings.managedBranding, () => managedBranding())
  handle(IpcChannels.settings.appUpdateInfo, () => getAppUpdateInfo())
  handle(IpcChannels.settings.installAppUpdate, () => installAppUpdate())
  handle(IpcChannels.settings.appUpdateProgress, () => getAppUpdateProgress())
  handle(IpcChannels.settings.appUpdateStatus, () => getAppUpdateStatus())

  // --- Backup -------------------------------------------------------------------------------
  handle(IpcChannels.backup.create, () => backupService.createBackup())
  handle(IpcChannels.backup.list, () => backupService.listBackups())
  handle(IpcChannels.backup.preview, (_e, filePath: string) =>
    backupService.previewBackup(filePath)
  )
  handle(IpcChannels.backup.restore, (_e, filePath: string) =>
    backupService.restoreBackup(filePath)
  )
  handle(IpcChannels.backup.revealFolder, () => shell.openPath(resolveBackupsDir()))
  handle(IpcChannels.backup.extraStatus, () => backupService.getExtraBackupStatus())
  handle(IpcChannels.backup.chooseExtraFolder, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: tr('Choose a second place for backups'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || !filePaths[0]) return null
    settingsRepo.updateSettings({ extraBackupFolder: filePaths[0] })
    return backupService.backUpToExtraFolderNow(filePaths[0])
  })
  handle(IpcChannels.backup.clearExtraFolder, () => {
    settingsRepo.updateSettings({ extraBackupFolder: '' })
    return backupService.getExtraBackupStatus('')
  })

  // --- Device sync ----------------------------------------------------------------------
  handle(IpcChannels.deviceSync.check, () => getDeviceSyncStatus())

  // --- Import / export -----------------------------------------------------------------------
  handle(IpcChannels.importExport.pickImportFile, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: tr('Spreadsheet (Excel or CSV)'), extensions: ['xlsx', 'csv'] }]
    })
    return canceled ? null : filePaths[0]
  })
  handle(IpcChannels.importExport.pickExportPath, async (_e, defaultFileName: string) => {
    const isCsv = defaultFileName.toLowerCase().endsWith('.csv')
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultFileName,
      filters: [
        isCsv
          ? { name: tr('CSV file'), extensions: ['csv'] }
          : { name: tr('Excel Workbook'), extensions: ['xlsx'] }
      ]
    })
    return canceled ? null : filePath
  })
  handle(IpcChannels.importExport.importRoster, (_e, filePath: string, classId?: string) =>
    importExportService.importRoster(filePath, classId)
  )
  handle(
    IpcChannels.importExport.exportCourseGradeSheet,
    (_e, courseGroupId: string, filePath: string) =>
      importExportService.exportCourseGradeSheetXlsx(courseGroupId, filePath)
  )
  handle(IpcChannels.importExport.exportGradebook, (_e, classId: string, filePath: string) =>
    importExportService.exportGradebookXlsx(classId, filePath)
  )
  handle(IpcChannels.importExport.exportAttendance, (_e, classId: string, filePath: string) =>
    importExportService.exportAttendanceCsv(classId, filePath)
  )
  handle(
    IpcChannels.importExport.exportHomeworkSubmissions,
    (_e, homeworkAssignmentId: string, classId: string, filePath: string) =>
      importExportService.exportHomeworkSubmissionsCsv(homeworkAssignmentId, classId, filePath)
  )

  // --- Print --------------------------------------------------------------------------------
  handle(
    IpcChannels.print.printStudentReport,
    async (_e, studentId: string, classId: string, suggestedFileName: string) => {
      const win = createPrintWindow()
      try {
        await loadAppRoute(win, `/print/student/${studentId}/${classId}`)
        await waitForPrintReady(win)
        const pdfBuffer = await win.webContents.printToPDF({ printBackground: true })

        const { canceled, filePath } = await showSaveDialogOnTop({
          defaultPath: suggestedFileName,
          filters: [{ name: 'PDF', extensions: ['pdf'] }]
        })
        if (canceled || !filePath) return { saved: false as const }

        await writeFile(filePath, pdfBuffer)
        return { saved: true as const, filePath }
      } finally {
        win.destroy()
      }
    }
  )
  handle(IpcChannels.print.printClassReports, (_e, classId: string, suggestedFileName: string) =>
    printRouteToPdf(`/print/class/${classId}`, suggestedFileName)
  )
  handle(IpcChannels.print.printClassLetters, (_e, classId: string, suggestedFileName: string) =>
    printRouteToPdf(`/print/letters/${classId}`, suggestedFileName)
  )

  // --- Standards ------------------------------------------------------------------------
  handle(IpcChannels.standards.list, () => standardsRepo.listStandards())
  handle(IpcChannels.standards.create, (_e, input: standardsRepo.CreateStandardInput) =>
    standardsRepo.createStandard(input)
  )
  handle(IpcChannels.standards.update, (_e, id: string, patch: standardsRepo.UpdateStandardInput) =>
    standardsRepo.updateStandard(id, patch)
  )
  handle(IpcChannels.standards.remove, (_e, id: string) => standardsRepo.deleteStandard(id))

  // --- Rubrics --------------------------------------------------------------------------
  handle(IpcChannels.rubrics.list, () => rubricsRepo.listRubrics())
  handle(IpcChannels.rubrics.get, (_e, id: string) => rubricsRepo.getRubric(id))
  handle(IpcChannels.rubrics.create, (_e, input: rubricsRepo.CreateRubricInput) =>
    rubricsRepo.createRubric(input)
  )
  handle(IpcChannels.rubrics.update, (_e, id: string, input: rubricsRepo.UpdateRubricInput) =>
    rubricsRepo.updateRubric(id, input)
  )
  handle(IpcChannels.rubrics.remove, (_e, id: string) => rubricsRepo.deleteRubric(id))

  // --- Rubric scores ----------------------------------------------------------------------
  handle(IpcChannels.rubricScores.list, (_e, assessmentId: string, studentId: string) =>
    rubricScoresRepo.listRubricScores(assessmentId, studentId)
  )
  handle(IpcChannels.rubricScores.save, (_e, input: rubricScoresRepo.SaveRubricScoresInput) =>
    rubricScoresRepo.saveRubricScores(input)
  )
  handle(
    IpcChannels.homeworkRubricScores.list,
    (_e, homeworkAssignmentId: string, studentId: string) =>
      homeworkRubricScoresRepo.listHomeworkRubricScores(homeworkAssignmentId, studentId)
  )
  handle(
    IpcChannels.homeworkRubricScores.save,
    async (_e, input: homeworkRubricScoresRepo.SaveHomeworkRubricScoresInput) => {
      const assignment = homeworkRepo.getHomeworkAssignment(input.homeworkAssignmentId)
      if (!assignment?.rubricId)
        throw new AppError('EB-0005', tr('This assignment has no rubric linked.'))
      const result = homeworkRubricScoresRepo.saveHomeworkRubricScores(input, assignment.rubricId)
      await pushSubmissionGrade({
        homeworkAssignmentId: input.homeworkAssignmentId,
        studentId: input.studentId,
        grade: `${result.pointsEarned}/${result.maxPoints}`,
        feedback: input.feedback ?? null
      })
      return result
    }
  )
  handle(IpcChannels.homeworkQuestions.list, (_e, homeworkAssignmentId: string) =>
    homeworkQuestionsRepo.listHomeworkQuestions(homeworkAssignmentId)
  )
  handle(
    IpcChannels.homeworkQuestions.replace,
    (_e, homeworkAssignmentId: string, questions: homeworkQuestionsRepo.DraftHomeworkQuestion[]) =>
      homeworkQuestionsRepo.replaceHomeworkQuestions(homeworkAssignmentId, questions)
  )

  // --- Audit log ----------------------------------------------------------------------------
  handle(IpcChannels.auditLog.list, (_e, filter?: { studentId?: string; classId?: string }) =>
    auditLogRepo.listAuditLog(filter)
  )

  // --- Student log entries ---------------------------------------------------------------
  handle(IpcChannels.studentLogEntries.listByStudent, (_e, studentId: string) =>
    studentLogEntriesRepo.listStudentLogEntries(studentId)
  )
  handle(
    IpcChannels.studentLogEntries.create,
    (_e, input: studentLogEntriesRepo.CreateStudentLogEntryInput) =>
      studentLogEntriesRepo.createStudentLogEntry(input)
  )
  handle(
    IpcChannels.studentLogEntries.update,
    (_e, id: string, patch: studentLogEntriesRepo.UpdateStudentLogEntryInput) =>
      studentLogEntriesRepo.updateStudentLogEntry(id, patch)
  )
  handle(IpcChannels.studentLogEntries.remove, (_e, id: string) =>
    studentLogEntriesRepo.deleteStudentLogEntry(id)
  )
  handle(IpcChannels.studentLogEntries.listParentCommunications, () =>
    studentLogEntriesRepo.listParentCommunications()
  )

  // --- Lesson resources -------------------------------------------------------------------
  handle(IpcChannels.lessonResources.list, () => lessonResourcesRepo.listLessonResources())
  handle(
    IpcChannels.lessonResources.create,
    (_e, input: lessonResourcesRepo.CreateLessonResourceInput) =>
      lessonResourcesRepo.createLessonResource(input)
  )
  handle(
    IpcChannels.lessonResources.update,
    (_e, id: string, patch: lessonResourcesRepo.UpdateLessonResourceInput) =>
      lessonResourcesRepo.updateLessonResource(id, patch)
  )
  handle(IpcChannels.lessonResources.remove, (_e, id: string) => {
    resourceChunksRepo.deleteResourceChunks(id)
    lessonResourcesRepo.deleteLessonResource(id)
  })
  handle(IpcChannels.lessonResources.pickFile, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] })
    return canceled || !filePaths[0] ? null : filePaths[0]
  })
  handle(IpcChannels.lessonResources.openPath, (_e, filePath: string) => shell.openPath(filePath))
  handle(IpcChannels.lessonResources.openExternal, (_e, url: string) => {
    // Only web pages and email: a resource's link may come from a shared Course Pack.
    if (!isSafeExternalUrl(url)) {
      throw new AppError('EB-0004', tr('Only web (http/https) and email links can be opened.'))
    }
    return shell.openExternal(url.trim())
  })

  // --- Notebook (chat with your Resources library) ------------------------------------------
  handle(IpcChannels.notebook.indexResource, (_e, resourceId: string) => indexResource(resourceId))
  handle(IpcChannels.notebook.indexAll, async () => {
    const resources = lessonResourcesRepo.listLessonResources()
    let indexed = 0
    for (const resource of resources) {
      try {
        await indexResource(resource.id)
        indexed++
      } catch {
        // One unreadable/unfetchable resource shouldn't stop the rest of the library
        // from indexing — the per-resource error is still visible via its own
        // "Index" button if the teacher retries it individually.
      }
    }
    return indexed
  })
  handle(IpcChannels.notebook.ask, (_e, question: string, resourceIds: string[] | null) =>
    askNotebook(question, resourceIds)
  )
  handle(
    IpcChannels.notebook.draftPracticeSet,
    (_e, resourceId: string, kind: 'flashcards' | 'quiz') =>
      draftPracticeSet(resourceId, kind === 'quiz' ? 'quiz' : 'flashcards')
  )
  handle(
    IpcChannels.notebook.clearPracticeSet,
    (_e, resourceId: string, kind: 'flashcards' | 'quiz') =>
      clearPracticeSet(resourceId, kind === 'quiz' ? 'quiz' : 'flashcards')
  )
  handle(
    IpcChannels.notebook.approveAiMaterial,
    (_e, resourceId: string, kind: string, approved: boolean) => {
      if (!(AI_MATERIAL_KINDS as readonly string[]).includes(kind)) {
        throw new AppError('EB-0004', `Unknown AI material "${kind}"`)
      }
      return lessonResourcesRepo.setLessonResourceAiApproval(
        resourceId,
        kind as AiMaterialKind,
        approved === true
      )
    }
  )
  handle(IpcChannels.notebook.draftStudyGuide, (_e, resourceId: string) =>
    draftStudyGuide(resourceId)
  )

  // --- Course groups / composite grades ----------------------------------------------------
  handle(IpcChannels.courseGroups.list, () => courseGroupsRepo.listCourseGroups())
  handle(IpcChannels.courseGroups.create, (_e, input: courseGroupsRepo.CreateCourseGroupInput) =>
    courseGroupsRepo.createCourseGroup(input)
  )
  handle(IpcChannels.courseGroups.rename, (_e, id: string, name: string) =>
    courseGroupsRepo.renameCourseGroup(id, name)
  )
  handle(IpcChannels.courseGroups.remove, (_e, id: string) =>
    courseGroupsRepo.deleteCourseGroup(id)
  )
  handle(IpcChannels.courseGroups.getComposite, (_e, courseGroupId: string) =>
    getCourseGroupComposite(courseGroupId)
  )

  // --- Seat assignments -------------------------------------------------------------------
  handle(IpcChannels.seatAssignments.listByClass, (_e, classId: string) =>
    seatAssignmentsRepo.listSeatAssignments(classId)
  )
  handle(
    IpcChannels.seatAssignments.assignSeat,
    (_e, classId: string, studentId: string, row: number, col: number) =>
      seatAssignmentsRepo.assignSeat(classId, studentId, row, col)
  )
  handle(IpcChannels.seatAssignments.unassignSeat, (_e, classId: string, studentId: string) =>
    seatAssignmentsRepo.unassignSeat(classId, studentId)
  )
  handle(IpcChannels.seatAssignments.clear, (_e, classId: string) =>
    seatAssignmentsRepo.clearSeatingChart(classId)
  )

  // --- Assignment submissions --------------------------------------------------------------
  handle(IpcChannels.assignmentSubmissions.listByAssessment, (_e, assessmentId: string) =>
    assignmentSubmissionsRepo.listSubmissionsByAssessment(assessmentId)
  )
  handle(IpcChannels.assignmentSubmissions.listByClass, (_e, classId: string) =>
    assignmentSubmissionsRepo.listSubmissionsByClass(classId)
  )
  handle(IpcChannels.assignmentSubmissions.pickFile, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] })
    return canceled || !filePaths[0] ? null : filePaths[0]
  })
  handle(
    IpcChannels.assignmentSubmissions.upsert,
    (_e, input: assignmentSubmissionsRepo.UpsertAssignmentSubmissionInput) =>
      assignmentSubmissionsRepo.upsertAssignmentSubmission(input)
  )
  handle(IpcChannels.assignmentSubmissions.remove, (_e, id: string) =>
    assignmentSubmissionsRepo.deleteAssignmentSubmission(id)
  )
  handle(IpcChannels.assignmentSubmissions.openPath, (_e, filePath: string) =>
    shell.openPath(filePath)
  )

  // --- Exit tickets -----------------------------------------------------------------------
  handle(IpcChannels.importExport.exportEverything, async () => {
    const stamp = new Date().toISOString().slice(0, 10)
    const { canceled, filePath } = await showSaveDialogOnTop({
      defaultPath: `EduBoard-everything-${stamp}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (canceled || !filePath) return { saved: false }
    const sheets = await importExportService.exportEverythingXlsx(filePath)
    return { saved: true, filePath, sheets }
  })

  // --- Dashboard: today and students to check on --------------------------------------------
  handle(IpcChannels.today.overview, () => getTodayOverview())
  handle(IpcChannels.today.watchList, () => getWatchList())

  // --- Report card comments ---------------------------------------------------------------
  handle(IpcChannels.reportComments.list, (_e, classId: string) =>
    reportCommentsRepo.listReportComments(String(classId))
  )
  handle(IpcChannels.reportComments.set, (_e, classId: string, studentId: string, text: string) => {
    if (
      !enrollmentsRepo.getRosterForClass(String(classId)).some((r) => r.student.id === studentId)
    ) {
      throw new AppError('EB-0003', tr('That student isn’t in this class.'))
    }
    reportCommentsRepo.setReportComment(String(classId), String(studentId), String(text ?? ''))
  })

  // --- Classroom tab: behaviour points ---------------------------------------------------
  handle(IpcChannels.behaviourPoints.add, (_e, input) => {
    const classId = String(input?.classId ?? '')
    const studentId = String(input?.studentId ?? '')
    // Only a student in this class can get points in it.
    if (!enrollmentsRepo.getRosterForClass(classId).some((r) => r.student.id === studentId)) {
      throw new AppError('EB-0003', tr('That student isn’t in this class.'))
    }
    return behaviourPointsRepo.addBehaviourPoint({
      classId,
      studentId,
      points: Number(input?.points),
      reason: typeof input?.reason === 'string' ? input.reason : null,
      category: typeof input?.category === 'string' ? input.category : null
    })
  })
  handle(
    IpcChannels.behaviourPoints.summary,
    (_e, classId: string, studentId: string) =>
      behaviourPointsRepo.pointSummaries(String(classId)).get(String(studentId)) ?? []
  )
  handle(IpcChannels.behaviourPoints.totals, (_e, classId: string, weekStartIso: string) =>
    behaviourPointsRepo.behaviourTotals(String(classId), String(weekStartIso))
  )
  handle(IpcChannels.behaviourPoints.undoLast, (_e, classId: string) =>
    behaviourPointsRepo.undoLastBehaviourPoint(String(classId))
  )

  // --- School pack ----------------------------------------------------------------------
  handle(IpcChannels.schoolPack.export, async () => {
    const pack = makeSchoolPack(settingsRepo.getSettings(), termsRepo.listTerms())
    const name = (pack.schoolName || 'school').replace(/[^\p{L}\p{N}-]+/gu, '_')
    const { canceled, filePath } = await showSaveDialogOnTop({
      defaultPath: `${name}.eduboard-school.json`,
      filters: [{ name: tr('EduBoard school pack'), extensions: ['json'] }]
    })
    if (canceled || !filePath) return { saved: false }
    await writeFile(filePath, JSON.stringify(pack, null, 2))
    return { saved: true, filePath }
  })
  handle(IpcChannels.schoolPack.preview, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: tr('EduBoard school pack'), extensions: ['json'] }]
    })
    if (canceled || !filePaths[0]) return null
    const pack = parseSchoolPack(await readFile(filePaths[0], 'utf-8'))
    const plan = planSchoolPack(pack, settingsRepo.getSettings(), termsRepo.listTerms())
    return { filePath: filePaths[0], changes: plan.changes }
  })
  handle(IpcChannels.schoolPack.apply, async (_e, filePath: string) => {
    const pack = parseSchoolPack(await readFile(String(filePath), 'utf-8'))
    const existing = termsRepo.listTerms()
    const plan = planSchoolPack(pack, settingsRepo.getSettings(), existing)
    // What the school set for everyone on this computer stays as it is.
    plan.settings = withoutLocked(plan.settings, lockedBrandingKeys())
    if (Object.keys(plan.settings).length) settingsRepo.updateSettings(plan.settings)
    let order = existing.reduce((max, t) => Math.max(max, t.sortOrder), 0)
    for (const t of plan.newTerms) termsRepo.createTerm({ ...t, sortOrder: ++order })
    if (plan.settings.terminology) saveUiPrefs({ terminology: plan.settings.terminology })
    if (plan.settings.appDisplayName !== undefined) {
      saveUiPrefs({ appName: plan.settings.appDisplayName })
    }
    if (plan.settings.schoolLogo !== undefined) applyWindowIcon(plan.settings.schoolLogo)
    if (plan.settings.appDisplayName !== undefined || plan.settings.schoolLogo !== undefined) {
      brandShortcuts()
    }
    // New words only show once screens reload.
    return { changes: plan.changes, reload: !!plan.settings.terminology }
  })
  handle(IpcChannels.schoolPack.importCss, async () => {
    if (lockedBrandingKeys().includes('customCss')) return null
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: tr('Stylesheet'), extensions: ['css'] }]
    })
    if (canceled || !filePaths[0]) return null
    const css = await readFile(filePaths[0], 'utf-8')
    settingsRepo.updateSettings({ customCss: sanitizeCss(css) })
    return checkCss(css, MAX_CSS_CHARS)
  })
  handle(IpcChannels.schoolPack.saveExampleCss, async (_e, css?: unknown, fileName?: unknown) => {
    const own = typeof css === 'string' && css.trim() ? css : null
    const { canceled, filePath } = await showSaveDialogOnTop({
      title: own ? tr('Save a copy of this style') : tr('Save an example stylesheet'),
      defaultPath:
        typeof fileName === 'string' && /^[\w .-]{1,80}\.css$/.test(fileName)
          ? fileName
          : 'eduboard-school.css',
      filters: [{ name: tr('Stylesheet'), extensions: ['css'] }]
    })
    if (canceled || !filePath) return false
    await writeFile(filePath, own ? sanitizeCss(own) : exampleStylesheet(), 'utf-8')
    return true
  })

  // --- Course packs ----------------------------------------------------------------------
  handle(IpcChannels.coursePack.preview, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: tr('EduBoard course pack'), extensions: ['json'] }]
    })
    if (canceled || !filePaths[0]) return null
    const pack = parseCoursePack(await readFile(filePaths[0], 'utf-8'))
    return {
      filePath: filePaths[0],
      id: pack.id,
      name: pack.name,
      description: pack.description ?? null,
      subject: pack.subject ?? null,
      terms: pack.terms.map((term) => ({
        key: term.key,
        name: term.name,
        schoolYear: term.schoolYear,
        startDate: term.startDate
      })),
      counts: {
        standards: pack.standards?.length ?? 0,
        rubrics: pack.rubrics?.length ?? 0,
        resources: pack.resources?.length ?? 0,
        studentFields: pack.studentFields?.length ?? 0,
        assessments: pack.assessments?.length ?? 0,
        homework: pack.homework?.length ?? 0,
        publishedHomework: (pack.homework ?? []).filter((h) => h.status === 'published').length,
        lessons: pack.lessons?.length ?? 0
      }
    }
  })
  handle(
    IpcChannels.coursePack.apply,
    async (
      _e,
      filePath: string,
      termBindings: Record<string, string>,
      firstClassDates: Record<string, string> = {},
      options: { publishHomework?: boolean } = {}
    ) => {
      const pack = parseCoursePack(await readFile(String(filePath), 'utf-8'))
      // A successful Course Pack changes real curriculum records and class links. Keep a
      // normal EduBoard recovery point immediately before it, in addition to the install
      // transaction's automatic rollback if anything fails mid-import.
      backupService.createBackup()
      const result = coursePacksRepo.installCoursePack({
        pack,
        termBindings,
        firstClassDates,
        publishHomework: options?.publishHomework === true
      })
      return {
        courseGroupId: result.courseGroupId,
        created: result.created,
        reused: result.reused
      }
    }
  )

  // --- Password protection --------------------------------------------------------------
  handle(IpcChannels.security.status, () => security.getSecurityStatus())
  handle(IpcChannels.security.unlock, (_e, secret: string) => security.unlock(String(secret)))
  handle(IpcChannels.security.lock, () => security.lockNow())
  handle(IpcChannels.security.enable, (_e, password: string) => {
    backupService.createBackup() // a copy from just before, in case anything goes wrong
    const result = security.enableProtection(String(password))
    backupService.createBackup() // and a protected one straight after
    return result
  })
  handle(IpcChannels.security.changePassword, (_e, current: string, next: string) =>
    security.changePassword(String(current), String(next))
  )
  handle(IpcChannels.security.disable, (_e, password: string) =>
    security.disableProtection(String(password))
  )
  handle(IpcChannels.security.unprotectedBackups, () => backupService.listUnprotectedBackups())
  handle(IpcChannels.security.deleteUnprotectedBackups, () =>
    backupService.deleteUnprotectedBackups()
  )

  handle(IpcChannels.exitTickets.getByClass, (_e, classId: string) =>
    exitTicketsRepo.getExitTicketByClass(classId)
  )
  handle(IpcChannels.exitTickets.upsert, (_e, input: exitTicketsRepo.UpsertExitTicketInput) =>
    exitTicketsRepo.upsertExitTicket(input)
  )
  handle(
    IpcChannels.exitTickets.setOpen,
    (_e, id: string, isOpen: boolean, autoCloseMinutes?: number | null) => {
      if (isOpen) startExitTicketServer()
      return exitTicketsRepo.setExitTicketOpen(id, isOpen, autoCloseMinutes ?? null)
    }
  )
  handle(IpcChannels.exitTickets.listResponses, (_e, exitTicketId: string) =>
    exitTicketsRepo.listExitTicketResponses(exitTicketId)
  )
  handle(IpcChannels.exitTickets.clearResponses, (_e, exitTicketId: string) =>
    exitTicketsRepo.clearExitTicketResponses(exitTicketId)
  )
  handle(IpcChannels.exitTickets.getServerInfo, () => getExitTicketServerInfo())
  handle(IpcChannels.exitTickets.getQrDataUrl, (_e, url: string) => QRCode.toDataURL(url))

  // --- Classroom Hub (local classroom Wi-Fi only) -----------------------------------------
  handle(IpcChannels.classroomHub.getStatus, (_e, classId: string) =>
    getClassroomHubStatus(classId)
  )
  handle(IpcChannels.classroomHub.open, (_e, classId: string, lessonId: string) =>
    openClassroomHub(classId, lessonId)
  )
  handle(IpcChannels.classroomHub.close, (_e, classId: string) => closeClassroomHub(classId))

  // --- AI (optional, requires a teacher-supplied API key) --------------------------------
  handle(IpcChannels.ai.draftLessonPlan, (_e, input: DraftLessonPlanInput) =>
    aiService.draftLessonPlan(input)
  )
  handle(IpcChannels.ai.suggestCommentPhrases, (_e, input: SuggestCommentPhrasesInput) =>
    aiService.suggestCommentPhrases(input)
  )
  handle(IpcChannels.ai.testConnection, (_e, config: AiConnectionConfig) =>
    aiService.testConnection(config)
  )

  // --- Homework assignments ------------------------------------------------------------------
  handle(IpcChannels.homeworkAssignments.listAll, () => homeworkRepo.listAllHomeworkAssignments())
  handle(IpcChannels.homeworkAssignments.listByClass, (_e, classId: string) =>
    homeworkRepo.listHomeworkAssignmentsByClass(classId)
  )
  handle(
    IpcChannels.homeworkAssignments.create,
    (_e, input: homeworkRepo.CreateHomeworkAssignmentInput) =>
      homeworkRepo.createHomeworkAssignment(input)
  )
  handle(
    IpcChannels.homeworkAssignments.update,
    (_e, id: string, patch: homeworkRepo.UpdateHomeworkAssignmentInput) =>
      homeworkRepo.updateHomeworkAssignment(id, patch)
  )
  handle(IpcChannels.homeworkAssignments.remove, (_e, id: string) =>
    homeworkRepo.deleteHomeworkAssignment(id)
  )
  handle(
    IpcChannels.homeworkAssignments.listSubmissions,
    (_e, homeworkAssignmentId: string, classId: string) =>
      homeworkRepo.listSubmissionsForAssignment(homeworkAssignmentId, classId)
  )
  handle(
    IpcChannels.homeworkAssignments.setSubmissionStatus,
    (_e, input: homeworkRepo.SetHomeworkSubmissionStatusInput) =>
      homeworkRepo.setSubmissionStatus(input)
  )
  handle(IpcChannels.homeworkAssignments.pickFile, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] })
    return canceled || !filePaths[0] ? null : filePaths[0]
  })
  handle(IpcChannels.homeworkAssignments.openPath, (_e, filePath: string) =>
    shell.openPath(filePath)
  )
  handle(
    IpcChannels.homeworkAssignments.setSubmissionGrade,
    async (_e, input: homeworkRepo.SetHomeworkSubmissionGradeInput) => {
      const result = homeworkRepo.setSubmissionGrade(input)
      await pushSubmissionGrade(input)
      return result
    }
  )
  handle(
    IpcChannels.homeworkAssignments.setSubmissionPortfolio,
    async (_e, input: homeworkRepo.SetHomeworkSubmissionPortfolioInput) => {
      homeworkRepo.setSubmissionPortfolio(input)
      await pushSubmissionPortfolio(input)
    }
  )
  handle(
    IpcChannels.homeworkAssignments.openSubmissionFile,
    async (_e, homeworkAssignmentId: string, studentId: string, fileName: string) => {
      const localPath = await downloadSubmissionFile(homeworkAssignmentId, studentId, fileName)
      // A student's upload might be a program. Open documents directly; for anything
      // else, show the file in its folder and let the teacher decide.
      if (isSafeToOpen(localPath)) return shell.openPath(localPath)
      shell.showItemInFolder(localPath)
      return ''
    }
  )

  handle(
    IpcChannels.homeworkAssignments.draftFeedback,
    (_e, homeworkAssignmentId: string, studentId: string) =>
      draftSubmissionFeedback(homeworkAssignmentId, studentId)
  )

  // --- Portal invites -------------------------------------------------------------------------
  handle(
    IpcChannels.portalInvites.createBatch,
    (_e, input: portalInvitesRepo.CreatePortalInviteBatchInput) =>
      portalInvitesRepo.createInviteBatch(input)
  )
  handle(IpcChannels.portalJoinLinks.overview, async (_e, classId: string) => {
    const links = portalJoinLinksRepo.listActiveJoinLinks(String(classId))
    const studentLinks: Record<string, PortalJoinLink> = {}
    for (const link of links)
      if (link.kind === 'student' && link.studentId) studentLinks[link.studentId] = link
    return {
      portalUrl: normalizePortalUrl(settingsRepo.getSettings().portalUrl),
      classLink: links.find((l) => l.kind === 'class_link') ?? null,
      studentLinks,
      studentsWithAccounts: await getStudentsWithPortalAccounts()
    }
  })
  handle(IpcChannels.portalJoinLinks.createClassLink, (_e, classId: string) =>
    portalJoinLinksRepo.createClassLink(String(classId))
  )
  handle(IpcChannels.portalJoinLinks.turnOffClassLink, (_e, classId: string) =>
    portalJoinLinksRepo.turnOffClassLink(String(classId))
  )
  handle(IpcChannels.portalJoinLinks.createStudentLink, (_e, classId: string, studentId: string) =>
    portalJoinLinksRepo.getOrCreateStudentLink(String(classId), String(studentId))
  )
  handle(IpcChannels.portalInvites.listBatchesByClass, (_e, classId: string) =>
    portalInvitesRepo.listInviteBatchesByClass(classId)
  )
  handle(IpcChannels.portalInvites.getBatch, (_e, batchId: string) =>
    portalInvitesRepo.getInviteBatch(batchId)
  )
  handle(IpcChannels.portalInvites.revoke, (_e, inviteId: string) =>
    portalInvitesRepo.revokeInvite(inviteId)
  )
  handle(
    IpcChannels.portalInvites.printBatch,
    async (_e, batchId: string, suggestedFileName: string) => {
      const win = createPrintWindow()
      try {
        await loadAppRoute(win, `/print/invite-batch/${batchId}`)
        await waitForPrintReady(win)
        const pdfBuffer = await win.webContents.printToPDF({ printBackground: true })

        const { canceled, filePath } = await showSaveDialogOnTop({
          defaultPath: suggestedFileName,
          filters: [{ name: 'PDF', extensions: ['pdf'] }]
        })
        if (canceled || !filePath) return { saved: false as const }

        await writeFile(filePath, pdfBuffer)
        portalInvitesRepo.markInviteBatchPrinted(batchId)
        return { saved: true as const, filePath }
      } finally {
        win.destroy()
      }
    }
  )

  // --- Portal sync ---------------------------------------------------------------------------
  handle(IpcChannels.portalSync.publish, () => publishToPortal())
  handle(IpcChannels.portalSync.status, () => getPublishStatus())
  handle(IpcChannels.portalSync.pullSubmissions, () => pullSubmissionsFromPortal())
  handle(IpcChannels.portalSync.reviewStats, () => getReviewStats())
  handle(IpcChannels.portalSync.aiActivity, (_e, studentId: string, homeworkId: string | null) =>
    getStudentAiActivity(String(studentId), homeworkId ? String(homeworkId) : null)
  )
  handle(IpcChannels.portalProfiles.get, (_e, studentId: string) => getPortalProfile(studentId))
  handle(IpcChannels.portalMessages.listThreads, () => listMessageThreads())
  handle(IpcChannels.portalMessages.send, (_e, accountId: string, body: string) =>
    sendTeacherMessage(accountId, body)
  )
  handle(IpcChannels.portalMessages.markRead, (_e, accountId: string) =>
    markMessageThreadRead(accountId)
  )
  handle(IpcChannels.portalMessages.translate, (_e, messageId: string, targetLang: string) =>
    translateMessage(messageId, targetLang)
  )
  handle(IpcChannels.sampleSchool.status, () => isSampleSchool())
  handle(IpcChannels.sampleSchool.open, (_e, fresh?: boolean) => openSampleSchool(!!fresh))
  handle(IpcChannels.sampleSchool.leave, () => leaveSampleSchool())
  handle(IpcChannels.studentTimeline.get, (_e, studentId: string) => studentTimeline(studentId))
  handle(IpcChannels.scoreImport.read, (_e, filePath: string, sheetIndex?: number) =>
    readScoreSheet(filePath, sheetIndex ?? 0)
  )
  handle(IpcChannels.scoreImport.apply, (_e, request: ScoreImportRequest) =>
    applyScoreImport(request)
  )
  handle(IpcChannels.reportCards.send, (_e, classId: string, title: string) =>
    sendReportCards(classId, title)
  )
  handle(IpcChannels.reportCards.progress, () => reportCardSendProgress())
  handle(IpcChannels.reportCards.list, (_e, classId: string) => listReportCardDeliveries(classId))
  handle(IpcChannels.reportCards.withdraw, (_e, classId: string, title: string) =>
    withdrawReportCards(classId, title)
  )
  handle(IpcChannels.classPosts.list, () => listClassPosts())
  handle(
    IpcChannels.classPosts.create,
    (
      _e,
      classId: string,
      body: string,
      imagePath: string | null,
      replySlip?: PostReplySlip | null
    ) => createClassPost(classId, body, imagePath, replySlip ?? null)
  )
  handle(IpcChannels.classPosts.remind, (_e, id: string) => remindUnrepliedFamilies(id))
  handle(IpcChannels.classPosts.remove, (_e, id: string) => deleteClassPost(id))
  handle(IpcChannels.classPosts.pickImage, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: tr('Images'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
    })
    return canceled || !filePaths[0] ? null : filePaths[0]
  })

  handle(IpcChannels.digest.sendNow, () => sendDigestNow())
  handle(IpcChannels.digest.preview, () => previewDigest())
  handle(IpcChannels.digest.setNewsletter, (_e, text: unknown, until: unknown) => {
    if (typeof text !== 'string') throw new AppError('EB-0004', tr('Write the newsletter first.'))
    return setDigestNewsletter(text, typeof until === 'string' ? until : null)
  })
  handle(IpcChannels.weeklySummary.get, () => {
    const summary = getWeeklySummary()
    return { summary, html: weeklySummaryHtml(summary) }
  })
  handle(IpcChannels.weeklySummary.print, () =>
    printRouteToPdf(
      '/print/weekly-summary',
      `${tr('Your week')} ${new Date().toISOString().slice(0, 10)}.pdf`
    )
  )
  handle(IpcChannels.weeklySummary.email, () => {
    const summary = getWeeklySummary()
    return emailTeacherSummary(
      tr('Your week: {date}', { date: summary.weekOf }),
      weeklySummaryHtml(summary)
    )
  })
  // Word and PowerPoint files, saved where the teacher chooses.
  const saveOffice = async (
    buffer: Buffer,
    defaultName: string,
    ext: 'docx' | 'pptx'
  ): Promise<{ saved: boolean; filePath?: string }> => {
    const { canceled, filePath } = await showSaveDialogOnTop({
      defaultPath: `${defaultName.replace(/[^\p{L}\p{N} ._-]/gu, '').trim() || 'EduBoard'}.${ext}`,
      filters: [{ name: ext === 'docx' ? 'Word' : 'PowerPoint', extensions: [ext] }]
    })
    if (canceled || !filePath) return { saved: false }
    await writeFile(filePath, buffer)
    return { saved: true, filePath }
  }
  handle(IpcChannels.office.word, async (_e, what) => {
    switch (what?.kind) {
      case 'letters':
        return saveOffice(
          await lettersDocx(what.classId),
          `${classesRepo.getClass(what.classId)?.name ?? ''} - ${tr('Parent letters')}`,
          'docx'
        )
      case 'reportCards':
        return saveOffice(
          await reportCardsDocx(what.classId),
          `${classesRepo.getClass(what.classId)?.name ?? ''} - ${tr('Report cards')}`,
          'docx'
        )
      case 'lessonPlan':
        return saveOffice(await lessonPlanDocx(what.planId), tr('Lesson plan'), 'docx')
      case 'newsletter':
        if (typeof what.text !== 'string' || !what.text.trim()) {
          throw new AppError('EB-0004', tr('Write the newsletter first.'))
        }
        return saveOffice(await newsletterDocx(what.text), tr('Newsletter'), 'docx')
      default:
        throw new AppError('EB-0004', tr('Nothing to export.'))
    }
  })
  handle(IpcChannels.office.slides, async (_e, planId: string) =>
    saveOffice(await lessonPlanPptx(String(planId)), tr('Lesson plan'), 'pptx')
  )
  handle(IpcChannels.usagePing.preview, () => usagePingPreview())
  handle(IpcChannels.errorReport.get, () => {
    const s = settingsRepo.getSettings()
    return errorReportText({ language: uiLanguage(), portal: !!s.portalUrl })
  })
  handle(IpcChannels.errorReport.recent, () =>
    recentErrors(8).map(({ at, code, message, ref }) => ({ at, code, message, ref }))
  )
  handle(IpcChannels.errorReport.logWindowError, (_e, input) => logWindowError(input))
  handle(IpcChannels.errorReport.openFolder, () => shell.showItemInFolder(errorLogPath()))
  handle(IpcChannels.groupChats.send, (_e, groupId: string, text: string, title: string) =>
    sendToSavedGroupChat(String(groupId), String(text ?? ''), String(title ?? ''))
  )
  handle(IpcChannels.groupChats.test, (_e, group: { webhook?: unknown; secret?: unknown }) =>
    sendToGroupChat(
      {
        webhook: String(group?.webhook ?? ''),
        secret: typeof group?.secret === 'string' ? group.secret : ''
      },
      tr('EduBoard is connected to this group. Posts from the teacher will appear here.'),
      'EduBoard'
    )
  )
  handle(IpcChannels.newsletter.facts, (_e, choice: NewsletterSourceChoice) =>
    gatherNewsletterFacts(choice)
  )
  handle(
    IpcChannels.newsletter.draft,
    (
      _e,
      input: {
        structure: NewsletterStructure
        customSections: string[]
        facts: NewsletterFact[]
        notes: string
      }
    ) => draftNewsletter(input)
  )
  handle(
    IpcChannels.newsletter.savedDraft,
    () => settingsRepo.getStoredValue<string>(NEWSLETTER_DRAFT_KEY) ?? ''
  )
  handle(IpcChannels.newsletter.saveDraft, (_e, text: unknown) =>
    settingsRepo.setStoredValue(NEWSLETTER_DRAFT_KEY, typeof text === 'string' ? text : '')
  )
  handle(IpcChannels.portalAccounts.listResetRequests, () => listPortalResetRequests())
  handle(IpcChannels.portalAccounts.answerResetRequest, (_e, id: string, approve: boolean) =>
    answerPortalResetRequest(id, approve)
  )
  handle(IpcChannels.portalAccounts.resetPassword, (_e, username: string, newPassword: string) =>
    resetPortalPassword(username, newPassword)
  )
}
