import { dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { writeFile } from 'fs/promises'
import { IpcChannels } from '@shared/ipc'

import * as studentsRepo from '../repositories/students'
import * as termsRepo from '../repositories/terms'
import * as classesRepo from '../repositories/classes'
import * as gradeCategoriesRepo from '../repositories/gradeCategories'
import * as enrollmentsRepo from '../repositories/enrollments'
import * as assessmentsRepo from '../repositories/assessments'
import * as scoresRepo from '../repositories/scores'
import * as attendanceRepo from '../repositories/attendanceRecords'
import * as lessonPlansRepo from '../repositories/lessonPlans'
import * as settingsRepo from '../repositories/settingsRepo'
import * as reportsService from '../services/reports'
import * as backupService from '../services/backup'
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
  handle(IpcChannels.classes.update, (_e, id: string, patch: classesRepo.UpdateClassInput) =>
    classesRepo.updateClass(id, patch)
  )
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
  handle(IpcChannels.reports.studentAttendanceSummary, (_e, studentId: string, classId: string) =>
    reportsService.getStudentAttendanceSummary(studentId, classId)
  )

  // --- Settings -----------------------------------------------------------------------------
  handle(IpcChannels.settings.get, () => settingsRepo.getSettings())
  handle(IpcChannels.settings.update, (_e, patch) => settingsRepo.updateSettings(patch))

  // --- Backup -------------------------------------------------------------------------------
  handle(IpcChannels.backup.create, () => backupService.createBackup())
  handle(IpcChannels.backup.list, () => backupService.listBackups())
  handle(IpcChannels.backup.restore, (_e, filePath: string) =>
    backupService.restoreBackup(filePath)
  )
  handle(IpcChannels.backup.revealFolder, () => shell.openPath(resolveBackupsDir()))

  // --- Import / export -----------------------------------------------------------------------
  handle(IpcChannels.importExport.pickImportFile, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Roster (Excel or CSV)', extensions: ['xlsx', 'csv'] }]
    })
    return canceled ? null : filePaths[0]
  })
  handle(IpcChannels.importExport.pickExportPath, async (_e, defaultFileName: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultFileName,
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
    })
    return canceled ? null : filePath
  })
  handle(IpcChannels.importExport.importRoster, (_e, filePath: string, classId?: string) =>
    importExportService.importRoster(filePath, classId)
  )
  handle(IpcChannels.importExport.exportGradebook, (_e, classId: string, filePath: string) =>
    importExportService.exportGradebookXlsx(classId, filePath)
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
}
