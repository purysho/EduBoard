import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcChannels } from '@shared/ipc'
import type { EduBoardApi } from '@shared/api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped IPC boundary; the `api` object below gives every call its real type
const invoke = (channel: string, ...args: unknown[]): Promise<any> =>
  ipcRenderer.invoke(channel, ...args)

const api: EduBoardApi = {
  students: {
    list: (includeArchived) => invoke(IpcChannels.students.list, includeArchived),
    create: (input) => invoke(IpcChannels.students.create, input),
    update: (id, patch) => invoke(IpcChannels.students.update, id, patch),
    remove: (id) => invoke(IpcChannels.students.remove, id)
  },
  terms: {
    list: () => invoke(IpcChannels.terms.list),
    create: (input) => invoke(IpcChannels.terms.create, input),
    update: (id, patch) => invoke(IpcChannels.terms.update, id, patch),
    remove: (id) => invoke(IpcChannels.terms.remove, id)
  },
  classes: {
    list: (includeArchived) => invoke(IpcChannels.classes.list, includeArchived),
    create: (input) => invoke(IpcChannels.classes.create, input),
    update: (id, patch) => invoke(IpcChannels.classes.update, id, patch),
    remove: (id) => invoke(IpcChannels.classes.remove, id)
  },
  gradeCategories: {
    listByClass: (classId) => invoke(IpcChannels.gradeCategories.listByClass, classId),
    create: (input) => invoke(IpcChannels.gradeCategories.create, input),
    update: (id, patch) => invoke(IpcChannels.gradeCategories.update, id, patch),
    remove: (id) => invoke(IpcChannels.gradeCategories.remove, id)
  },
  enrollments: {
    listByClass: (classId) => invoke(IpcChannels.enrollments.listByClass, classId),
    listByStudent: (studentId) => invoke(IpcChannels.enrollments.listByStudent, studentId),
    enroll: (input) => invoke(IpcChannels.enrollments.enroll, input),
    updateStatus: (id, status) => invoke(IpcChannels.enrollments.updateStatus, id, status),
    unenroll: (studentId, classId) => invoke(IpcChannels.enrollments.unenroll, studentId, classId)
  },
  assessments: {
    listByClass: (classId) => invoke(IpcChannels.assessments.listByClass, classId),
    create: (input) => invoke(IpcChannels.assessments.create, input),
    update: (id, patch) => invoke(IpcChannels.assessments.update, id, patch),
    remove: (id) => invoke(IpcChannels.assessments.remove, id)
  },
  scores: {
    listByAssessment: (assessmentId) => invoke(IpcChannels.scores.listByAssessment, assessmentId),
    listByClass: (classId) => invoke(IpcChannels.scores.listByClass, classId),
    listByStudentAndClass: (studentId, classId) =>
      invoke(IpcChannels.scores.listByStudentAndClass, studentId, classId),
    upsert: (input) => invoke(IpcChannels.scores.upsert, input),
    upsertBulk: (inputs) => invoke(IpcChannels.scores.upsertBulk, inputs),
    history: (assessmentId, studentId) =>
      invoke(IpcChannels.scores.history, assessmentId, studentId)
  },
  attendance: {
    listByClass: (classId) => invoke(IpcChannels.attendance.listByClass, classId),
    listByStudentAndClass: (studentId, classId) =>
      invoke(IpcChannels.attendance.listByStudentAndClass, studentId, classId),
    mark: (input) => invoke(IpcChannels.attendance.mark, input),
    markBulk: (inputs) => invoke(IpcChannels.attendance.markBulk, inputs)
  },
  lessonPlans: {
    listByClass: (classId) => invoke(IpcChannels.lessonPlans.listByClass, classId),
    listUpcoming: (fromDate, limit) =>
      invoke(IpcChannels.lessonPlans.listUpcoming, fromDate, limit),
    create: (input) => invoke(IpcChannels.lessonPlans.create, input),
    update: (id, patch) => invoke(IpcChannels.lessonPlans.update, id, patch),
    remove: (id) => invoke(IpcChannels.lessonPlans.remove, id)
  },
  reports: {
    dashboardStats: () => invoke(IpcChannels.reports.dashboardStats),
    classRoster: (classId) => invoke(IpcChannels.reports.classRoster, classId),
    classReport: (classId) => invoke(IpcChannels.reports.classReport, classId),
    studentClassGrade: (studentId, classId) =>
      invoke(IpcChannels.reports.studentClassGrade, studentId, classId),
    studentAttendanceSummary: (studentId, classId) =>
      invoke(IpcChannels.reports.studentAttendanceSummary, studentId, classId)
  },
  settings: {
    get: () => invoke(IpcChannels.settings.get),
    update: (patch) => invoke(IpcChannels.settings.update, patch)
  },
  backup: {
    create: () => invoke(IpcChannels.backup.create),
    list: () => invoke(IpcChannels.backup.list),
    preview: (filePath) => invoke(IpcChannels.backup.preview, filePath),
    restore: (filePath) => invoke(IpcChannels.backup.restore, filePath),
    revealFolder: () => invoke(IpcChannels.backup.revealFolder)
  },
  deviceSync: {
    check: () => invoke(IpcChannels.deviceSync.check)
  },
  importExport: {
    pickImportFile: () => invoke(IpcChannels.importExport.pickImportFile),
    pickExportPath: (defaultFileName) =>
      invoke(IpcChannels.importExport.pickExportPath, defaultFileName),
    importRoster: (filePath, classId) =>
      invoke(IpcChannels.importExport.importRoster, filePath, classId),
    exportGradebook: (classId, filePath) =>
      invoke(IpcChannels.importExport.exportGradebook, classId, filePath),
    exportAttendance: (classId, filePath) =>
      invoke(IpcChannels.importExport.exportAttendance, classId, filePath)
  },
  print: {
    printStudentReport: (studentId, classId, suggestedFileName) =>
      invoke(IpcChannels.print.printStudentReport, studentId, classId, suggestedFileName)
  },
  standards: {
    list: () => invoke(IpcChannels.standards.list),
    create: (input) => invoke(IpcChannels.standards.create, input),
    update: (id, patch) => invoke(IpcChannels.standards.update, id, patch),
    remove: (id) => invoke(IpcChannels.standards.remove, id)
  },
  rubrics: {
    list: () => invoke(IpcChannels.rubrics.list),
    get: (id) => invoke(IpcChannels.rubrics.get, id),
    create: (input) => invoke(IpcChannels.rubrics.create, input),
    update: (id, input) => invoke(IpcChannels.rubrics.update, id, input),
    remove: (id) => invoke(IpcChannels.rubrics.remove, id)
  },
  rubricScores: {
    list: (assessmentId, studentId) =>
      invoke(IpcChannels.rubricScores.list, assessmentId, studentId),
    save: (input) => invoke(IpcChannels.rubricScores.save, input)
  },
  studentLogEntries: {
    listByStudent: (studentId) => invoke(IpcChannels.studentLogEntries.listByStudent, studentId),
    create: (input) => invoke(IpcChannels.studentLogEntries.create, input),
    update: (id, patch) => invoke(IpcChannels.studentLogEntries.update, id, patch),
    remove: (id) => invoke(IpcChannels.studentLogEntries.remove, id),
    listParentCommunications: () => invoke(IpcChannels.studentLogEntries.listParentCommunications)
  },
  lessonResources: {
    list: () => invoke(IpcChannels.lessonResources.list),
    create: (input) => invoke(IpcChannels.lessonResources.create, input),
    update: (id, patch) => invoke(IpcChannels.lessonResources.update, id, patch),
    remove: (id) => invoke(IpcChannels.lessonResources.remove, id),
    pickFile: () => invoke(IpcChannels.lessonResources.pickFile),
    openPath: (filePath) => invoke(IpcChannels.lessonResources.openPath, filePath),
    openExternal: (url) => invoke(IpcChannels.lessonResources.openExternal, url)
  },
  assignmentSubmissions: {
    listByAssessment: (assessmentId) =>
      invoke(IpcChannels.assignmentSubmissions.listByAssessment, assessmentId),
    listByClass: (classId) => invoke(IpcChannels.assignmentSubmissions.listByClass, classId),
    pickFile: () => invoke(IpcChannels.assignmentSubmissions.pickFile),
    upsert: (input) => invoke(IpcChannels.assignmentSubmissions.upsert, input),
    remove: (id) => invoke(IpcChannels.assignmentSubmissions.remove, id),
    openPath: (filePath) => invoke(IpcChannels.assignmentSubmissions.openPath, filePath)
  },
  exitTickets: {
    getByClass: (classId) => invoke(IpcChannels.exitTickets.getByClass, classId),
    upsert: (input) => invoke(IpcChannels.exitTickets.upsert, input),
    setOpen: (id, isOpen) => invoke(IpcChannels.exitTickets.setOpen, id, isOpen),
    listResponses: (exitTicketId) => invoke(IpcChannels.exitTickets.listResponses, exitTicketId),
    clearResponses: (exitTicketId) => invoke(IpcChannels.exitTickets.clearResponses, exitTicketId),
    getServerInfo: () => invoke(IpcChannels.exitTickets.getServerInfo),
    getQrDataUrl: (url) => invoke(IpcChannels.exitTickets.getQrDataUrl, url)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
