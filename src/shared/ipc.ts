// Every renderer<->main call goes through one of these channel names. Keeping the full
// map here (instead of scattering string literals) is what lets preload/index.ts build a
// typed `window.api` and main/ipc/register.ts wire up matching handlers without drifting.

export const IpcChannels = {
  students: {
    list: 'students:list',
    create: 'students:create',
    update: 'students:update',
    remove: 'students:remove',
    merge: 'students:merge',
    exportData: 'students:exportData',
    erase: 'students:erase'
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
    remove: 'classes:remove',
    duplicateForNewTerm: 'classes:duplicateForNewTerm',
    startNextTerm: 'classes:startNextTerm',
    exportHandover: 'classes:exportHandover',
    getAiProfile: 'classes:getAiProfile',
    setAiProfile: 'classes:setAiProfile'
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
    history: 'scores:history',
    attempts: 'scores:attempts',
    addAttempt: 'scores:addAttempt'
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
  classroomHub: {
    getStatus: 'classroomHub:getStatus',
    open: 'classroomHub:open',
    project: 'classroomHub:project',
    close: 'classroomHub:close'
  },
  lessonEvidence: {
    listByClass: 'lessonEvidence:listByClass',
    upsert: 'lessonEvidence:upsert'
  },
  lessonPlans: {
    listByClass: 'lessonPlans:listByClass',
    listUpcoming: 'lessonPlans:listUpcoming',
    create: 'lessonPlans:create',
    update: 'lessonPlans:update',
    remove: 'lessonPlans:remove',
    copyWeek: 'lessonPlans:copyWeek',
    shiftPlanned: 'lessonPlans:shiftPlanned',
    resourceIds: 'lessonPlans:resourceIds',
    setResources: 'lessonPlans:setResources',
    exportOfflinePack: 'lessonPlans:exportOfflinePack',
    teachingDates: 'lessonPlans:teachingDates',
    createUnit: 'lessonPlans:createUnit'
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
    attendanceWarnings: 'reports:attendanceWarnings',
    setupProgress: 'reports:setupProgress',
    classRoster: 'reports:classRoster',
    classReport: 'reports:classReport',
    studentClassGrade: 'reports:studentClassGrade',
    studentAttendanceSummary: 'reports:studentAttendanceSummary',
    analyticsOverview: 'reports:analyticsOverview',
    studentGradeTrend: 'reports:studentGradeTrend'
  },
  competencies: {
    matrix: 'competencies:matrix'
  },
  curriculumMap: {
    get: 'curriculumMap:get'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
    appUpdateInfo: 'settings:appUpdateInfo',
    installAppUpdate: 'settings:installAppUpdate',
    appUpdateProgress: 'settings:appUpdateProgress',
    appUpdateStatus: 'settings:appUpdateStatus',
    managedBranding: 'settings:managedBranding'
  },
  backup: {
    create: 'backup:create',
    list: 'backup:list',
    preview: 'backup:preview',
    restore: 'backup:restore',
    revealFolder: 'backup:revealFolder',
    extraStatus: 'backup:extraStatus',
    chooseExtraFolder: 'backup:chooseExtraFolder',
    clearExtraFolder: 'backup:clearExtraFolder'
  },
  deviceSync: {
    check: 'deviceSync:check'
  },
  importExport: {
    importRoster: 'importExport:importRoster',
    exportGradebook: 'importExport:exportGradebook',
    exportCourseGradeSheet: 'importExport:exportCourseGradeSheet',
    exportAttendance: 'importExport:exportAttendance',
    exportHomeworkSubmissions: 'importExport:exportHomeworkSubmissions',
    pickImportFile: 'importExport:pickImportFile',
    pickExportPath: 'importExport:pickExportPath',
    exportEverything: 'importExport:exportEverything'
  },
  print: {
    printStudentReport: 'print:printStudentReport',
    printClassReports: 'print:printClassReports',
    printClassLetters: 'print:printClassLetters'
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
    exportOfflinePack: 'lessonResources:exportOfflinePack',
    importProgress: 'lessonResources:importProgress',
    listProgress: 'lessonResources:listProgress',
    openPath: 'lessonResources:openPath',
    openExternal: 'lessonResources:openExternal'
  },
  notebook: {
    indexResource: 'notebook:indexResource',
    indexAll: 'notebook:indexAll',
    ask: 'notebook:ask',
    draftStudyGuide: 'notebook:draftStudyGuide',
    draftPracticeSet: 'notebook:draftPracticeSet',
    saveManualPracticeSet: 'notebook:saveManualPracticeSet',
    clearPracticeSet: 'notebook:clearPracticeSet',
    approveAiMaterial: 'notebook:approveAiMaterial'
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
  today: {
    overview: 'today:overview',
    watchList: 'today:watchList'
  },
  reportComments: {
    list: 'reportComments:list',
    set: 'reportComments:set'
  },
  behaviourPoints: {
    add: 'behaviourPoints:add',
    totals: 'behaviourPoints:totals',
    undoLast: 'behaviourPoints:undoLast',
    summary: 'behaviourPoints:summary'
  },
  schoolPack: {
    export: 'schoolPack:export',
    preview: 'schoolPack:preview',
    apply: 'schoolPack:apply',
    importCss: 'schoolPack:importCss',
    saveExampleCss: 'schoolPack:saveExampleCss'
  },
  coursePack: {
    preview: 'coursePack:preview',
    apply: 'coursePack:apply'
  },
  security: {
    status: 'security:status',
    unlock: 'security:unlock',
    lock: 'security:lock',
    enable: 'security:enable',
    changePassword: 'security:changePassword',
    disable: 'security:disable',
    unprotectedBackups: 'security:unprotectedBackups',
    deleteUnprotectedBackups: 'security:deleteUnprotectedBackups'
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
    draftUnitPlan: 'ai:draftUnitPlan',
    suggestCommentPhrases: 'ai:suggestCommentPhrases',
    testConnection: 'ai:testConnection'
  },
  homeworkAssignments: {
    listAll: 'homeworkAssignments:listAll',
    listByClass: 'homeworkAssignments:listByClass',
    create: 'homeworkAssignments:create',
    copyToClasses: 'homeworkAssignments:copyToClasses',
    update: 'homeworkAssignments:update',
    remove: 'homeworkAssignments:remove',
    listSubmissions: 'homeworkAssignments:listSubmissions',
    setSubmissionStatus: 'homeworkAssignments:setSubmissionStatus',
    pickFile: 'homeworkAssignments:pickFile',
    openPath: 'homeworkAssignments:openPath',
    setSubmissionGrade: 'homeworkAssignments:setSubmissionGrade',
    setSubmissionPortfolio: 'homeworkAssignments:setSubmissionPortfolio',
    openSubmissionFile: 'homeworkAssignments:openSubmissionFile',
    draftFeedback: 'homeworkAssignments:draftFeedback'
  },
  portalJoinLinks: {
    overview: 'portalJoinLinks:overview',
    createClassLink: 'portalJoinLinks:createClassLink',
    turnOffClassLink: 'portalJoinLinks:turnOffClassLink',
    createStudentLink: 'portalJoinLinks:createStudentLink'
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
    pullSubmissions: 'portalSync:pullSubmissions',
    aiActivity: 'portalSync:aiActivity',
    reviewStats: 'portalSync:reviewStats',
    status: 'portalSync:status'
  },
  portalProfiles: {
    get: 'portalProfiles:get'
  },
  portalMessages: {
    listThreads: 'portalMessages:listThreads',
    send: 'portalMessages:send',
    markRead: 'portalMessages:markRead',
    translate: 'portalMessages:translate'
  },
  sampleSchool: {
    status: 'sampleSchool:status',
    open: 'sampleSchool:open',
    leave: 'sampleSchool:leave'
  },
  studentTimeline: {
    get: 'studentTimeline:get'
  },
  scoreImport: {
    read: 'scoreImport:read',
    apply: 'scoreImport:apply'
  },
  reportCards: {
    send: 'reportCards:send',
    progress: 'reportCards:progress',
    list: 'reportCards:list',
    withdraw: 'reportCards:withdraw'
  },
  classPosts: {
    list: 'classPosts:list',
    create: 'classPosts:create',
    remove: 'classPosts:remove',
    remind: 'classPosts:remind',
    pickImage: 'classPosts:pickImage'
  },
  digest: {
    sendNow: 'digest:sendNow',
    preview: 'digest:preview',
    setNewsletter: 'digest:setNewsletter'
  },
  weeklySummary: {
    get: 'weeklySummary:get',
    print: 'weeklySummary:print',
    email: 'weeklySummary:email'
  },
  office: {
    word: 'office:word',
    slides: 'office:slides',
    resourceWorksheet: 'office:resourceWorksheet',
    resourceSlides: 'office:resourceSlides'
  },
  usagePing: {
    preview: 'usagePing:preview'
  },
  errorReport: {
    get: 'errorReport:get',
    recent: 'errorReport:recent',
    logWindowError: 'errorReport:logWindowError',
    openFolder: 'errorReport:openFolder'
  },
  groupChats: {
    send: 'groupChats:send',
    route: 'groupChats:route',
    test: 'groupChats:test',
    pickQr: 'groupChats:pickQr',
    makeQr: 'groupChats:makeQr'
  },
  newsletter: {
    facts: 'newsletter:facts',
    draft: 'newsletter:draft',
    savedDraft: 'newsletter:savedDraft',
    saveDraft: 'newsletter:saveDraft'
  },
  portalAccounts: {
    resetPassword: 'portalAccounts:resetPassword',
    listResetRequests: 'portalAccounts:listResetRequests',
    answerResetRequest: 'portalAccounts:answerResetRequest'
  }
} as const
