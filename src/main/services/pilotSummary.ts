// Builds the pilot summary (shared/pilotSummary.ts) from this computer's data. Only
// counts are read: how many rows a table has, how many classes and students, and on
// how many different days something was recorded. No column holding a name, a grade
// or text is selected.
import { app } from 'electron'
import { getSqlite } from '../db/client'
import { isSampleSchool } from '../db/path'
import { listClasses } from '../repositories/classes'
import { listStudents } from '../repositories/students'
import { getSettings } from '../repositories/settingsRepo'
import { uiLanguage } from '@shared/i18n'
import { osName } from '@shared/usagePing'
import { PILOT_SUMMARY_FEATURES, buildPilotSummary, type PilotSummary } from '@shared/pilotSummary'
import { isProtected } from './security'

function countRows(table: string): number {
  // Table names come from the fixed list in PILOT_SUMMARY_FEATURES, never from outside.
  try {
    const row = getSqlite().prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as
      { n: number } | undefined
    return row?.n ?? 0
  } catch {
    return 0 // a table an older database doesn't have yet
  }
}

function activeDays(): number {
  try {
    const row = getSqlite()
      .prepare('SELECT COUNT(DISTINCT substr(created_at, 1, 10)) AS n FROM audit_log')
      .get() as { n: number } | undefined
    return row?.n ?? 0
  } catch {
    return 0
  }
}

export function pilotSummaryNow(now = new Date()): PilotSummary {
  const rowCounts: Record<string, number> = {}
  for (const f of PILOT_SUMMARY_FEATURES) rowCounts[f.table] = countRows(f.table)
  return buildPilotSummary({
    madeOn: now,
    appVersion: app.getVersion(),
    os: osName(process.platform),
    language: uiLanguage() === 'zh' ? 'zh' : 'en',
    pilotMode: getSettings().pilotMode === true,
    sampleSchool: isSampleSchool(),
    passwordProtected: isProtected(),
    classCount: listClasses(false).length,
    studentCount: listStudents(false).length,
    activeDays: activeDays(),
    rowCounts
  })
}
