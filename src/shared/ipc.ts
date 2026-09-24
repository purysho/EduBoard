// Every renderer<->main call goes through one of these channel names. Keeping the full
// map here (instead of scattering string literals) is what lets preload/index.ts build a
// typed `window.api` and main/ipc/register.ts wire up matching handlers without drifting.

export const IpcChannels = {
  students: {
    list: 'students:list',
    create: 'students:create',
    update: 'students:update',
    remove: 'students:remove'
  },
  terms: {
    list: 'terms:list',
    create: 'terms:create',
    update: 'terms:update',
    remove: 'terms:remove'
  },
  classes: {
    list: 'classes:list',
    create: 'classes:create',
    update: 'classes:update',
    remove: 'classes:remove'
  },
  gradeCategories: {
    listByClass: 'gradeCategories:listByClass',
    create: 'gradeCategories:create',
    update: 'gradeCategories:update',
    remove: 'gradeCategories:remove'
  },
  enrollments: {
    listByClass: 'enrollments:listByClass',
    listByStudent: 'enrollments:listByStudent',
    enroll: 'enrollments:enroll',
    updateStatus: 'enrollments:updateStatus',
    unenroll: 'enrollments:unenroll'
  },
  assessments: {
    listByClass: 'assessments:listByClass',
    create: 'assessments:create',
    update: 'assessments:update',
    remove: 'assessments:remove'
  },
  scores: {
    listByAssessment: 'scores:listByAssessment',
    listByClass: 'scores:listByClass',
    listByStudentAndClass: 'scores:listByStudentAndClass',
    upsert: 'scores:upsert',
    upsertBulk: 'scores:upsertBulk',
    history: 'scores:history'
  },
  attendance: {
    listByClass: 'attendance:listByClass',
    listByStudentAndClass: 'attendance:listByStudentAndClass',
    mark: 'attendance:mark',
    markBulk: 'attendance:markBulk'
  },
  attendanceCheckIn: {
    getStatus: 'attendanceCheckIn:getStatus',
    open: 'attendanceCheckIn:open',
    close: 'attendanceCheckIn:close'
  },
  lessonPlans: {
    listByClass: 'lessonPlans:listByClass',
    listUpcoming: 'lessonPlans:listUpcoming',
    create: 'lessonPlans:create',
    update: 'lessonPlans:update',
    remove: 'lessonPlans:remove'
  },
  scheduleSlots: {
    listByClass: 'scheduleSlots:listByClass',
    listAll: 'scheduleSlots:listAll',
    create: 'scheduleSlots:create',
    update: 'scheduleSlots:update',
    remove: 'scheduleSlots:remove'
  },
  reports: {
    dashboardStats: 'reports:dashboardStats',
    classRoster: 'reports:classRoster',
    classReport: 'reports:classReport',
    studentClassGrade: 'reports:studentClassGrade',
    studentAttendanceSummary: 'reports:studentAttendanceSummary',
    analyticsOverview: 'reports:analyticsOverview',
    studentGradeTrend: 'reports:studentGradeTrend'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update'
  },
  backup: {
    create: 'backup:create',
    list: 'backup:list',
    preview: 'backup:preview',
    restore: 'backup:restore',
    revealFolder: 'backup:revealFolder'
  },
  deviceSync: {
    check: 'deviceSync:check'
  },
  importExport: {
    importRoster: 'importExport:importRoster',
    exportGradebook: 'importExport:exportGradebook',
    exportAttendance: 'importExport:exportAttendance',
    exportHomeworkSubmissions: 'importExport:exportHomeworkSubmissions',
    pickImportFile: 'importExport:pickImportFile',
    pickExportPath: 'importExport:pickExportPath'
  },
  print: {
    printStudentReport: 'print:printStudentReport'
  },
  standards: {
    list: 'standards:list',
    create: 'standards:create',
    update: 'standards:update',
    remove: 'standards:remove'
  },
  rubrics: {
    list: 'rubrics:list',
    get: 'rubrics:get',
    create: 'rubrics:create',
    update: 'rubrics:update',
    remove: 'rubrics:remove'
  },
  rubricScores: {
    list: 'rubricScores:list',
    save: 'rubricScores:save'
  },
  homeworkRubricScores: {
    list: 'homeworkRubricScores:list',
    save: 'homeworkRubricScores:save'
  },
  homeworkQuestions: {
    list: 'homeworkQuestions:list',
    replace: 'homeworkQuestions:replace'
  },
  auditLog: {
    list: 'auditLog:list'
  },
  studentLogEntries: {
    listByStudent: 'studentLogEntries:listByStudent',
    create: 'studentLogEntries:create',
    update: 'studentLogEntries:update',
    remove: 'studentLogEntries:remove',
    listParentCommunications: 'studentLogEntries:listParentCommunications'
  },
  lessonResources: {
    list: 'lessonResources:list',
    create: 'lessonResources:create',
    update: 'lessonResources:update',
    remove: 'lessonResources:remove',
    pickFile: 'lessonResources:pickFile',
    openPath: 'lessonResources:openPath',
    openExternal: 'lessonResources:openExternal'
  },
  notebook: {
    indexResource: 'notebook:indexResource',
    indexAll: 'notebook:indexAll',
    ask: 'notebook:ask',
    draftStudyGuide: 'notebook:draftStudyGuide'
  },
  courseGroups: {
    list: 'courseGroups:list',
    create: 'courseGroups:create',
    rename: 'courseGroups:rename',
    remove: 'courseGroups:remove',
    getComposite: 'courseGroups:getComposite'
  },
  seatAssignments: {
    listByClass: 'seatAssignments:listByClass',
    assignSeat: 'seatAssignments:assignSeat',
    unassignSeat: 'seatAssignments:unassignSeat',
    clear: 'seatAssignments:clear'
  },
  assignmentSubmissions: {
    listByAssessment: 'assignmentSubmissions:listByAssessment',
    listByClass: 'assignmentSubmissions:listByClass',
    pickFile: 'assignmentSubmissions:pickFile',
    upsert: 'assignmentSubmissions:upsert',
    remove: 'assignmentSubmissions:remove',
    openPath: 'assignmentSubmissions:openPath'
  },
  exitTickets: {
    getByClass: 'exitTickets:getByClass',
    upsert: 'exitTickets:upsert',
    setOpen: 'exitTickets:setOpen',
    listResponses: 'exitTickets:listResponses',
    clearResponses: 'exitTickets:clearResponses',
    getServerInfo: 'exitTickets:getServerInfo',
    getQrDataUrl: 'exitTickets:getQrDataUrl'
  },
  ai: {
    draftLessonPlan: 'ai:draftLessonPlan',
    draftReportComment: 'ai:draftReportComment'
  },
  homeworkAssignments: {
    listAll: 'homeworkAssignments:listAll',
    listByClass: 'homeworkAssignments:listByClass',
    create: 'homeworkAssignments:create',
    update: 'homeworkAssignments:update',
    remove: 'homeworkAssignments:remove',
    listSubmissions: 'homeworkAssignments:listSubmissions',
    setSubmissionStatus: 'homeworkAssignments:setSubmissionStatus',
    pickFile: 'homeworkAssignments:pickFile',
    openPath: 'homeworkAssignments:openPath',
    setSubmissionGrade: 'homeworkAssignments:setSubmissionGrade',
    setSubmissionPortfolio: 'homeworkAssignments:setSubmissionPortfolio',
    openSubmissionFile: 'homeworkAssignments:openSubmissionFile'
  },
  portalInvites: {
    createBatch: 'portalInvites:createBatch',
    listBatchesByClass: 'portalInvites:listBatchesByClass',
    getBatch: 'portalInvites:getBatch',
    revoke: 'portalInvites:revoke',
    printBatch: 'portalInvites:printBatch'
  },
  portalSync: {
    publish: 'portalSync:publish',
    pullSubmissions: 'portalSync:pullSubmissions'
  },
  portalMessages: {
    listThreads: 'portalMessages:listThreads',
    send: 'portalMessages:send',
    markRead: 'portalMessages:markRead',
    translate: 'portalMessages:translate'
  },
  classPosts: {
    list: 'classPosts:list',
    create: 'classPosts:create',
    remove: 'classPosts:remove',
    pickImage: 'classPosts:pickImage'
  },
  digest: {
    sendNow: 'digest:sendNow'
  }
} as const
