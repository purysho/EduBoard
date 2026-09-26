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
    remove: (id) => invoke(IpcChannels.students.remove, id),
    merge: (keepId, duplicateId) => invoke(IpcChannels.students.merge, keepId, duplicateId)
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
    remove: (id) => invoke(IpcChannels.classes.remove, id),
    duplicateForNewTerm: (id, input) => invoke(IpcChannels.classes.duplicateForNewTerm, id, input)
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
  attendanceCheckIn: {
    getStatus: (classId) => invoke(IpcChannels.attendanceCheckIn.getStatus, classId),
    open: (classId, date) => invoke(IpcChannels.attendanceCheckIn.open, classId, date),
    close: (classId) => invoke(IpcChannels.attendanceCheckIn.close, classId)
  },
  lessonPlans: {
    listByClass: (classId) => invoke(IpcChannels.lessonPlans.listByClass, classId),
    listUpcoming: (fromDate, limit) =>
      invoke(IpcChannels.lessonPlans.listUpcoming, fromDate, limit),
    create: (input) => invoke(IpcChannels.lessonPlans.create, input),
    update: (id, patch) => invoke(IpcChannels.lessonPlans.update, id, patch),
    remove: (id) => invoke(IpcChannels.lessonPlans.remove, id)
  },
  scheduleSlots: {
    listByClass: (classId) => invoke(IpcChannels.scheduleSlots.listByClass, classId),
    listAll: () => invoke(IpcChannels.scheduleSlots.listAll),
    create: (input) => invoke(IpcChannels.scheduleSlots.create, input),
    update: (id, patch) => invoke(IpcChannels.scheduleSlots.update, id, patch),
    remove: (id) => invoke(IpcChannels.scheduleSlots.remove, id)
  },
  reports: {
    dashboardStats: () => invoke(IpcChannels.reports.dashboardStats),
    setupProgress: () => invoke(IpcChannels.reports.setupProgress),
    classRoster: (classId) => invoke(IpcChannels.reports.classRoster, classId),
    classReport: (classId) => invoke(IpcChannels.reports.classReport, classId),
    studentClassGrade: (studentId, classId) =>
      invoke(IpcChannels.reports.studentClassGrade, studentId, classId),
    studentAttendanceSummary: (studentId, classId) =>
      invoke(IpcChannels.reports.studentAttendanceSummary, studentId, classId),
    analyticsOverview: () => invoke(IpcChannels.reports.analyticsOverview),
    studentGradeTrend: (studentId, classId) =>
      invoke(IpcChannels.reports.studentGradeTrend, studentId, classId)
  },
  settings: {
    get: () => invoke(IpcChannels.settings.get),
    update: (patch) => invoke(IpcChannels.settings.update, patch),
    checkForUpdate: () => invoke(IpcChannels.settings.checkForUpdate)
  },
  backup: {
    create: () => invoke(IpcChannels.backup.create),
    list: () => invoke(IpcChannels.backup.list),
    preview: (filePath) => invoke(IpcChannels.backup.preview, filePath),
    restore: (filePath) => invoke(IpcChannels.backup.restore, filePath),
    revealFolder: () => invoke(IpcChannels.backup.revealFolder),
    extraStatus: () => invoke(IpcChannels.backup.extraStatus),
    chooseExtraFolder: () => invoke(IpcChannels.backup.chooseExtraFolder),
    clearExtraFolder: () => invoke(IpcChannels.backup.clearExtraFolder)
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
    exportCourseGradeSheet: (courseGroupId, filePath) =>
      invoke(IpcChannels.importExport.exportCourseGradeSheet, courseGroupId, filePath),
    exportAttendance: (classId, filePath) =>
      invoke(IpcChannels.importExport.exportAttendance, classId, filePath),
    exportHomeworkSubmissions: (homeworkAssignmentId, classId, filePath) =>
      invoke(
        IpcChannels.importExport.exportHomeworkSubmissions,
        homeworkAssignmentId,
        classId,
        filePath
      )
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
  homeworkRubricScores: {
    list: (homeworkAssignmentId, studentId) =>
      invoke(IpcChannels.homeworkRubricScores.list, homeworkAssignmentId, studentId),
    save: (input) => invoke(IpcChannels.homeworkRubricScores.save, input)
  },
  homeworkQuestions: {
    list: (homeworkAssignmentId) =>
      invoke(IpcChannels.homeworkQuestions.list, homeworkAssignmentId),
    replace: (homeworkAssignmentId, questions) =>
      invoke(IpcChannels.homeworkQuestions.replace, homeworkAssignmentId, questions)
  },
  auditLog: {
    list: (filter) => invoke(IpcChannels.auditLog.list, filter)
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
  notebook: {
    indexResource: (resourceId) => invoke(IpcChannels.notebook.indexResource, resourceId),
    indexAll: () => invoke(IpcChannels.notebook.indexAll),
    ask: (question, resourceIds) => invoke(IpcChannels.notebook.ask, question, resourceIds),
    draftStudyGuide: (resourceId) => invoke(IpcChannels.notebook.draftStudyGuide, resourceId),
    draftPracticeSet: (resourceId, kind) =>
      invoke(IpcChannels.notebook.draftPracticeSet, resourceId, kind),
    clearPracticeSet: (resourceId, kind) =>
      invoke(IpcChannels.notebook.clearPracticeSet, resourceId, kind)
  },
  courseGroups: {
    list: () => invoke(IpcChannels.courseGroups.list),
    create: (input) => invoke(IpcChannels.courseGroups.create, input),
    rename: (id, name) => invoke(IpcChannels.courseGroups.rename, id, name),
    remove: (id) => invoke(IpcChannels.courseGroups.remove, id),
    getComposite: (courseGroupId) => invoke(IpcChannels.courseGroups.getComposite, courseGroupId)
  },
  seatAssignments: {
    listByClass: (classId) => invoke(IpcChannels.seatAssignments.listByClass, classId),
    assignSeat: (classId, studentId, row, col) =>
      invoke(IpcChannels.seatAssignments.assignSeat, classId, studentId, row, col),
    unassignSeat: (classId, studentId) =>
      invoke(IpcChannels.seatAssignments.unassignSeat, classId, studentId),
    clear: (classId) => invoke(IpcChannels.seatAssignments.clear, classId)
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
  },
  ai: {
    draftLessonPlan: (input) => invoke(IpcChannels.ai.draftLessonPlan, input),
    draftReportComment: (input) => invoke(IpcChannels.ai.draftReportComment, input),
    testConnection: (config) => invoke(IpcChannels.ai.testConnection, config)
  },
  homeworkAssignments: {
    listAll: () => invoke(IpcChannels.homeworkAssignments.listAll),
    listByClass: (classId) => invoke(IpcChannels.homeworkAssignments.listByClass, classId),
    create: (input) => invoke(IpcChannels.homeworkAssignments.create, input),
    update: (id, patch) => invoke(IpcChannels.homeworkAssignments.update, id, patch),
    remove: (id) => invoke(IpcChannels.homeworkAssignments.remove, id),
    listSubmissions: (homeworkAssignmentId, classId) =>
      invoke(IpcChannels.homeworkAssignments.listSubmissions, homeworkAssignmentId, classId),
    setSubmissionStatus: (input) =>
      invoke(IpcChannels.homeworkAssignments.setSubmissionStatus, input),
    pickFile: () => invoke(IpcChannels.homeworkAssignments.pickFile),
    openPath: (filePath) => invoke(IpcChannels.homeworkAssignments.openPath, filePath),
    setSubmissionGrade: (input) =>
      invoke(IpcChannels.homeworkAssignments.setSubmissionGrade, input),
    setSubmissionPortfolio: (input) =>
      invoke(IpcChannels.homeworkAssignments.setSubmissionPortfolio, input),
    openSubmissionFile: (homeworkAssignmentId, studentId, fileName) =>
      invoke(
        IpcChannels.homeworkAssignments.openSubmissionFile,
        homeworkAssignmentId,
        studentId,
        fileName
      ),
    draftFeedback: (homeworkAssignmentId, studentId) =>
      invoke(IpcChannels.homeworkAssignments.draftFeedback, homeworkAssignmentId, studentId)
  },
  portalJoinLinks: {
    overview: (classId) => invoke(IpcChannels.portalJoinLinks.overview, classId),
    createClassLink: (classId) => invoke(IpcChannels.portalJoinLinks.createClassLink, classId),
    turnOffClassLink: (classId) => invoke(IpcChannels.portalJoinLinks.turnOffClassLink, classId),
    createStudentLink: (classId, studentId) =>
      invoke(IpcChannels.portalJoinLinks.createStudentLink, classId, studentId)
  },
  portalInvites: {
    createBatch: (input) => invoke(IpcChannels.portalInvites.createBatch, input),
    listBatchesByClass: (classId) => invoke(IpcChannels.portalInvites.listBatchesByClass, classId),
    getBatch: (batchId) => invoke(IpcChannels.portalInvites.getBatch, batchId),
    revoke: (inviteId) => invoke(IpcChannels.portalInvites.revoke, inviteId),
    printBatch: (batchId, suggestedFileName) =>
      invoke(IpcChannels.portalInvites.printBatch, batchId, suggestedFileName)
  },
  portalSync: {
    publish: () => invoke(IpcChannels.portalSync.publish),
    pullSubmissions: () => invoke(IpcChannels.portalSync.pullSubmissions),
    aiActivity: (studentId, homeworkId) =>
      invoke(IpcChannels.portalSync.aiActivity, studentId, homeworkId),
    status: () => invoke(IpcChannels.portalSync.status)
  },
  portalProfiles: {
    get: (studentId) => invoke(IpcChannels.portalProfiles.get, studentId)
  },
  portalMessages: {
    listThreads: () => invoke(IpcChannels.portalMessages.listThreads),
    send: (accountId, body) => invoke(IpcChannels.portalMessages.send, accountId, body),
    markRead: (accountId) => invoke(IpcChannels.portalMessages.markRead, accountId),
    translate: (messageId, targetLang) =>
      invoke(IpcChannels.portalMessages.translate, messageId, targetLang)
  },
  classPosts: {
    list: () => invoke(IpcChannels.classPosts.list),
    create: (classId, body, imagePath) =>
      invoke(IpcChannels.classPosts.create, classId, body, imagePath),
    remove: (id) => invoke(IpcChannels.classPosts.remove, id),
    pickImage: () => invoke(IpcChannels.classPosts.pickImage)
  },
  portalAccounts: {
    resetPassword: (username, newPassword) =>
      invoke(IpcChannels.portalAccounts.resetPassword, username, newPassword),
    listResetRequests: () => invoke(IpcChannels.portalAccounts.listResetRequests),
    answerResetRequest: (id, approve) =>
      invoke(IpcChannels.portalAccounts.answerResetRequest, id, approve)
  },
  digest: {
    sendNow: () => invoke(IpcChannels.digest.sendNow)
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
