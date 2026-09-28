// Sending report cards privately to families on the Portal: each active student's report
// card is rendered exactly as "Print PDF" makes it, then sent on its own, so a family only
// ever receives their own child's. One hidden window is reused for the whole class.
import { AppError } from '@shared/errorCodes'
import { tr } from '@shared/i18n'
import type { ReportCardSendProgress, ReportCardSendResult } from '@shared/types'
import { getRosterForClass } from '../repositories/enrollments'
import { createPrintWindow, loadAppRoute, waitForPrintReady } from '../windows'
import { publishToPortal, uploadReportCard } from './portalSyncService'

let progress: ReportCardSendProgress | null = null

export function reportCardSendProgress(): ReportCardSendProgress | null {
  return progress
}

export async function sendReportCards(
  classId: string,
  title: string
): Promise<ReportCardSendResult> {
  const cleanTitle = title.trim().replace(/\s+/g, ' ')
  if (!cleanTitle) throw new AppError('EB-0004', tr('Give the report cards a title first.'))
  if (progress) throw new AppError('EB-1010', tr('Report cards are already being sent.'))

  const students = getRosterForClass(classId)
    .filter((r) => r.enrollment.status === 'active')
    .map((r) => r.student)
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
  const result: ReportCardSendResult = { sent: 0, failed: [] }
  if (!students.length) return result

  let done = 0
  progress = { done, total: students.length }
  try {
    // The Portal only takes report cards for students it already has in this class.
    await publishToPortal()
    const win = createPrintWindow()
    try {
      for (const s of students) {
        const name = `${s.firstName} ${s.lastName}`
        try {
          await loadAppRoute(win, `/print/student/${s.id}/${classId}`)
          await waitForPrintReady(win, 20_000)
          const pdf = await win.webContents.printToPDF({ printBackground: true })
          await uploadReportCard({ classId, studentId: s.id, title: cleanTitle, pdf })
          result.sent++
        } catch (err) {
          // One student's problem doesn't stop the rest; the teacher sees who is missing.
          // A problem every student will hit (sync secret, older Portal) stops at once.
          if (err instanceof AppError && err.code !== 'EB-1008') throw err
          result.failed.push({ name, message: err instanceof Error ? err.message : String(err) })
        }
        progress = { done: ++done, total: students.length }
      }
    } finally {
      win.destroy()
    }
  } finally {
    progress = null
  }
  return result
}
