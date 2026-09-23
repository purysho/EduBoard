import { dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { writeFile } from 'fs/promises'
import { IpcChannels } from '@shared/ipc'
import type { DraftLessonPlanInput, DraftReportCommentInput } from '@shared/types'

import * as studentsRepo from '../repositories/students'
import * as termsRepo from '../repositories/terms'
import * as classesRepo from '../repositories/classes'
import * as gradeCategoriesRepo from '../repositories/gradeCategories'
import * as enrollmentsRepo from '../repositories/enrollments'
import * as assessmentsRepo from '../repositories/assessments'
import * as scoresRepo from '../repositories/scores'
import * as attendanceRepo from '../repositories/attendanceRecords'
import * as lessonPlansRepo from '../repositories/lessonPlans'
import * as scheduleSlotsRepo from '../repositories/classScheduleSlots'
import * as settingsRepo from '../repositories/settingsRepo'
import * as standardsRepo from '../repositories/standards'
import * as rubricsRepo from '../repositories/rubrics'
import * as rubricScoresRepo from '../repositories/rubricScores'
import * as homeworkRubricScoresRepo from '../repositories/homeworkRubricScores'
import * as homeworkQuestionsRepo from '../repositories/homeworkQuestions'
import * as studentLogEntriesRepo from '../repositories/studentLogEntries'
import * as lessonResourcesRepo from '../repositories/lessonResources'
import * as resourceChunksRepo from '../repositories/resourceChunks'
import { indexResource, askNotebook, draftStudyGuide } from '../services/notebookService'
import * as assignmentSubmissionsRepo from '../repositories/assignmentSubmissions'
import * as seatAssignmentsRepo from '../repositories/seatAssignments'
import * as courseGroupsRepo from '../repositories/courseGroups'
import { getCourseGroupComposite } from '../services/compositeGrades'
import * as exitTicketsRepo from '../repositories/exitTickets'
import {
  closeAttendanceCheckIn,
  getAttendanceCheckInStatus,
  getExitTicketServerInfo,
  openAttendanceCheckIn,
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
  pushSubmissionGrade,
  pushSubmissionPortfolio,
  downloadSubmissionFile,
  listMessageThreads,
  sendTeacherMessage,
  markMessageThreadRead,
  listClassPosts,
  createClassPost,
  deleteClassPost,
  sendDigestNow
} from '../services/portalSyncService'
import * as backupService from '../services/backup'
import { getDeviceSyncStatus } from '../services/deviceSync'
import * as importExportService from '../services/importExport'
import { resolveBackupsDir } from '../db/path'
import { createPrintWindow, loadAppRoute, waitForPrintReady } from '../windows'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic IPC dispatch boundary; each handler below is fully typed
function handle<T>(channel: string, fn: (event: IpcMainInvokeEvent, ...args: any[]) => T): void {
  ipcMain.handle(channel, (event, ...args) => fn(event, ...args))
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
  handle(IpcChannels.students.remove, (_e, id: string) => studentsRepo.deleteStudent(id))

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

  // --- Attendance -----------------------------------------------------------------------
  handle(IpcChannels.attendance.listByClass, (_e, classId: string) =>
    attendanceRepo.listAttendanceByClass(classId)
  )
  handle(IpcChannels.attendance.listByStudentAndClass, (_e, studentId: string, classId: string) =>
    attendanceRepo.listAttendanceByStudentAndClass(studentId, classId)
  )
  handle(IpcChannels.attendance.mark, (_e, input: attendanceRepo.MarkAttendanceInput) =>
    attendanceRepo.markAttendance(input)
  )
  handle(IpcChannels.attendance.markBulk, (_e, inputs: attendanceRepo.MarkAttendanceInput[]) =>
    attendanceRepo.markAttendanceBulk(inputs)
  )

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

  // --- Settings -----------------------------------------------------------------------------
  handle(IpcChannels.settings.get, () => settingsRepo.getSettings())
  handle(IpcChannels.settings.update, (_e, patch) => settingsRepo.updateSettings(patch))

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

  // --- Device sync ----------------------------------------------------------------------
  handle(IpcChannels.deviceSync.check, () => getDeviceSyncStatus())

  // --- Import / export -----------------------------------------------------------------------
  handle(IpcChannels.importExport.pickImportFile, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Roster (Excel or CSV)', extensions: ['xlsx', 'csv'] }]
    })
    return canceled ? null : filePaths[0]
  })
  handle(IpcChannels.importExport.pickExportPath, async (_e, defaultFileName: string) => {
    const isCsv = defaultFileName.toLowerCase().endsWith('.csv')
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultFileName,
      filters: [
        isCsv
          ? { name: 'CSV file', extensions: ['csv'] }
          : { name: 'Excel Workbook', extensions: ['xlsx'] }
      ]
    })
    return canceled ? null : filePath
  })
  handle(IpcChannels.importExport.importRoster, (_e, filePath: string, classId?: string) =>
    importExportService.importRoster(filePath, classId)
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

        const { canceled, filePath } = await dialog.showSaveDialog({
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
      if (!assignment?.rubricId) throw new Error('This assignment has no rubric linked.')
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
  handle(IpcChannels.lessonResources.openExternal, (_e, url: string) => shell.openExternal(url))

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
  handle(IpcChannels.exitTickets.getByClass, (_e, classId: string) =>
    exitTicketsRepo.getExitTicketByClass(classId)
  )
  handle(IpcChannels.exitTickets.upsert, (_e, input: exitTicketsRepo.UpsertExitTicketInput) =>
    exitTicketsRepo.upsertExitTicket(input)
  )
  handle(IpcChannels.exitTickets.setOpen, (_e, id: string, isOpen: boolean) => {
    if (isOpen) startExitTicketServer()
    return exitTicketsRepo.setExitTicketOpen(id, isOpen)
  })
  handle(IpcChannels.exitTickets.listResponses, (_e, exitTicketId: string) =>
    exitTicketsRepo.listExitTicketResponses(exitTicketId)
  )
  handle(IpcChannels.exitTickets.clearResponses, (_e, exitTicketId: string) =>
    exitTicketsRepo.clearExitTicketResponses(exitTicketId)
  )
  handle(IpcChannels.exitTickets.getServerInfo, () => getExitTicketServerInfo())
  handle(IpcChannels.exitTickets.getQrDataUrl, (_e, url: string) => QRCode.toDataURL(url))

  // --- AI (optional, requires a teacher-supplied API key) --------------------------------
  handle(IpcChannels.ai.draftLessonPlan, (_e, input: DraftLessonPlanInput) =>
    aiService.draftLessonPlan(input)
  )
  handle(IpcChannels.ai.draftReportComment, (_e, input: DraftReportCommentInput) =>
    aiService.draftReportComment(input)
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
      return shell.openPath(localPath)
    }
  )

  // --- Portal invites -------------------------------------------------------------------------
  handle(
    IpcChannels.portalInvites.createBatch,
    (_e, input: portalInvitesRepo.CreatePortalInviteBatchInput) =>
      portalInvitesRepo.createInviteBatch(input)
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

        const { canceled, filePath } = await dialog.showSaveDialog({
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

  // --- Portal sync ---------------------------------------------------------------------------
  handle(IpcChannels.portalSync.publish, () => publishToPortal())
  handle(IpcChannels.portalSync.pullSubmissions, () => pullSubmissionsFromPortal())
  handle(IpcChannels.portalMessages.listThreads, () => listMessageThreads())
  handle(IpcChannels.portalMessages.send, (_e, accountId: string, body: string) =>
    sendTeacherMessage(accountId, body)
  )
  handle(IpcChannels.portalMessages.markRead, (_e, accountId: string) =>
    markMessageThreadRead(accountId)
  )
  handle(IpcChannels.classPosts.list, () => listClassPosts())
  handle(
    IpcChannels.classPosts.create,
    (_e, classId: string, body: string, imagePath: string | null) =>
      createClassPost(classId, body, imagePath)
  )
  handle(IpcChannels.classPosts.remove, (_e, id: string) => deleteClassPost(id))
  handle(IpcChannels.classPosts.pickImage, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
    })
    return canceled || !filePaths[0] ? null : filePaths[0]
  })

  handle(IpcChannels.digest.sendNow, () => sendDigestNow())
}
