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
    upsertBulk: 'scores:upsertBulk'
  },
  attendance: {
    listByClass: 'attendance:listByClass',
    listByStudentAndClass: 'attendance:listByStudentAndClass',
    mark: 'attendance:mark',
    markBulk: 'attendance:markBulk'
  },
  lessonPlans: {
    listByClass: 'lessonPlans:listByClass',
    listUpcoming: 'lessonPlans:listUpcoming',
    create: 'lessonPlans:create',
    update: 'lessonPlans:update',
    remove: 'lessonPlans:remove'
  },
  reports: {
    dashboardStats: 'reports:dashboardStats',
    classRoster: 'reports:classRoster',
    classReport: 'reports:classReport',
    studentClassGrade: 'reports:studentClassGrade',
    studentAttendanceSummary: 'reports:studentAttendanceSummary'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update'
  },
  backup: {
    create: 'backup:create',
    list: 'backup:list',
    restore: 'backup:restore',
    revealFolder: 'backup:revealFolder'
  },
  importExport: {
    importRoster: 'importExport:importRoster',
    exportGradebook: 'importExport:exportGradebook',
    pickImportFile: 'importExport:pickImportFile',
    pickExportPath: 'importExport:pickExportPath'
  },
  print: {
    printStudentReport: 'print:printStudentReport'
  }
} as const
