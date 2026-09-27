// The error log: every error a teacher is shown, with its code, and the full details of
// unexpected ones (with a short reference they can read out). It sits beside the
// database in logs/errors.log, so a teacher can send it (Settings → Help → Copy error
// report) and whoever helps can find the reference. Small and self-rotating.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { randomInt } from 'crypto'
import { app } from 'electron'
import { resolveDbPath } from '../db/path'
import { isAppErrorCode, splitCode, withCode } from '@shared/errorCodes'
import { tr } from '@shared/i18n'

export interface ErrorLogEntry {
  at: string
  code: string
  message: string
  /** Only for unexpected errors: the reference shown to the teacher. */
  ref?: string
  /** Where it happened: the IPC channel, or the screen for window errors. */
  where?: string
  stack?: string
}

const MAX_BYTES = 256 * 1024
/** The same coded error from the same place is logged once per 10 minutes: background
 * checks repeat while offline, and would push the useful entries out of the report. */
const REPEAT_MS = 10 * 60 * 1000
const lastLogged = new Map<string, number>()

export const errorLogPath = (): string => join(dirname(resolveDbPath()), 'logs', 'errors.log')

/** Six characters, no look-alikes (0/O, 1/I), easy to read over the phone. */
export function newErrorRef(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('')
}

export function logError(entry: Omit<ErrorLogEntry, 'at'>): void {
  if (!entry.ref) {
    const key = `${entry.code}|${entry.where ?? ''}`
    const now = Date.now()
    if (now - (lastLogged.get(key) ?? 0) < REPEAT_MS) return
    lastLogged.set(key, now)
  }
  try {
    const file = errorLogPath()
    mkdirSync(dirname(file), { recursive: true })
    if (existsSync(file) && statSync(file).size > MAX_BYTES) renameSync(file, `${file}.1`)
    const line: ErrorLogEntry = {
      at: new Date().toISOString(),
      ...entry,
      message: entry.message.slice(0, 1000),
      ...(entry.stack ? { stack: entry.stack.slice(0, 3000) } : {})
    }
    appendFileSync(file, JSON.stringify(line) + '\n')
  } catch {
    // Logging must never be the thing that breaks.
  }
}

/** The newest entries first. */
export function recentErrors(limit = 30): ErrorLogEntry[] {
  try {
    const file = errorLogPath()
    const lines = [
      ...(existsSync(`${file}.1`) ? readFileSync(`${file}.1`, 'utf8').split('\n') : []),
      ...(existsSync(file) ? readFileSync(file, 'utf8').split('\n') : [])
    ].filter(Boolean)
    return lines
      .slice(-limit)
      .reverse()
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as ErrorLogEntry]
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}

/** What an error thrown in a main-process handler becomes on its way to the window:
 * the teacher's message with its code at the end ("… [EB-1003]"). Anything without a
 * code was unexpected: it's logged in full with a reference, and the teacher sees a
 * plain sentence with EB-0900 and that reference. */
export function toWindowError(err: unknown, where: string): Error {
  const e = err as { code?: unknown; message?: unknown; stack?: unknown }
  const message = typeof e?.message === 'string' ? e.message : String(err)
  if (isAppErrorCode(e?.code)) {
    logError({ code: e.code, message, where })
    return new Error(withCode(message, e.code))
  }
  // Already carries a code (passed along from another layer).
  if (splitCode(message).code) return err instanceof Error ? err : new Error(message)
  const ref = newErrorRef()
  logError({
    code: 'EB-0900',
    message,
    ref,
    where,
    stack: typeof e?.stack === 'string' ? e.stack : undefined
  })
  console.error(`[EB-0900 ref ${ref}] ${where}:`, err)
  return new Error(
    withCode(
      tr('Something unexpected went wrong. The details are in the error report (Settings → Help).'),
      'EB-0900',
      ref
    )
  )
}

/** A screen that failed to draw (reported by the window). Returns the reference. */
export function logWindowError(input: {
  message?: unknown
  stack?: unknown
  where?: unknown
}): string {
  const ref = newErrorRef()
  logError({
    code: 'EB-0901',
    message: String(input?.message ?? '').slice(0, 1000) || 'Unknown error',
    ref,
    where: typeof input?.where === 'string' ? input.where.slice(0, 200) : undefined,
    stack: typeof input?.stack === 'string' ? input.stack : undefined
  })
  return ref
}

/** The report a teacher copies and sends: version, system, and the recent errors. */
export function errorReportText(extra: { language: string; portal: boolean }): string {
  const entries = recentErrors(30)
  const lines = [
    'EduBoard error report',
    `Version ${app.getVersion()} · ${process.platform} ${process.getSystemVersion?.() ?? ''} (${process.arch}) · language ${extra.language} · Portal ${extra.portal ? 'set up' : 'not set up'}`,
    `Made ${new Date().toISOString()}`,
    '',
    entries.length ? `Recent errors (newest first, ${entries.length}):` : 'No errors logged.'
  ]
  for (const e of entries) {
    lines.push(
      `${e.at}  ${e.code}${e.ref ? ` ref ${e.ref}` : ''}  ${e.where ?? ''}  ${e.message.replace(/\s+/g, ' ')}`
    )
    if (e.stack) {
      lines.push(
        ...e.stack
          .split('\n')
          .slice(1, 7)
          .map((l) => `      ${l.trim()}`)
      )
    }
  }
  return lines.join('\n')
}
