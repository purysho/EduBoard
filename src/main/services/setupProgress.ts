import { getSqlite } from '../db/client'
import { getSettings } from '../repositories/settingsRepo'
import { portalUrlProblem } from '@shared/portalUrl'
import type { SetupProgress } from '@shared/setupChecklist'

/** The facts behind the Dashboard's "Getting started" checklist, read straight from the
 * database and settings so each step reflects what's really been done. */
export function getSetupProgress(): SetupProgress {
  const db = getSqlite()
  const count = (sql: string): number => (db.prepare(sql).get() as { n: number }).n
  const settings = getSettings()

  const firstClass = db
    .prepare('SELECT id FROM classes WHERE archived = 0 ORDER BY created_at LIMIT 1')
    .get() as { id: string } | undefined

  const aiConfigured =
    settings.aiProvider === 'custom'
      ? Boolean(settings.aiCustomBaseUrl.trim() && settings.aiCustomModel.trim())
      : Boolean(settings.aiApiKey.trim())

  return {
    classCount: count('SELECT COUNT(*) AS n FROM classes WHERE archived = 0'),
    activeEnrollmentCount: count(
      `SELECT COUNT(*) AS n FROM enrollments e JOIN classes c ON c.id = e.class_id
       WHERE e.status = 'active' AND c.archived = 0`
    ),
    publishedHomeworkCount: count(
      "SELECT COUNT(*) AS n FROM homework_assignments WHERE status = 'published'"
    ),
    portalConnected: Boolean(
      settings.portalUrl.trim() &&
      settings.portalSyncSecret.trim() &&
      !portalUrlProblem(settings.portalUrl)
    ),
    // Printed strips (older) or any join link counts as having invited students.
    inviteBatchCount:
      count('SELECT COUNT(*) AS n FROM portal_invite_batches') +
      count('SELECT COUNT(*) AS n FROM portal_join_links'),
    sharedResourceCount: count(
      'SELECT COUNT(*) AS n FROM lesson_resources WHERE share_with_students = 1 AND class_id IS NOT NULL'
    ),
    aiConfigured,
    firstClassId: firstClass?.id ?? null
  }
}
