// The interface language and the school's own words for this computer. They live in the
// settings like everything else, and also in a small plain file next to the database,
// because the lock screen needs them before an encrypted database can be read, and each
// window needs them synchronously before any screen code runs (see
// src/renderer/src/i18nInit.ts).
import { app, ipcMain } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { currentDbPath } from './db/client'
import {
  languageFromLocale,
  setTerminology,
  setUiLanguage,
  type Terminology,
  type UiLanguage
} from '@shared/i18n'
import { cleanAppName } from '@shared/branding'
import { isTrustedIpcSender } from './ipc/senderValidation'

const CHANNEL = 'i18n:prefs'

export interface UiPrefs {
  language: UiLanguage
  terminology: Terminology
  /** The school's name for the app ('' for EduBoard), for the lock screen. */
  appName: string
}

interface StoredPrefs {
  language: UiLanguage | ''
  terminology: Terminology
  appName: string
  /** A copy of the pilotMode setting, so a local-only pilot holds even while an
   * encrypted database is still locked (main/services/pilotMode.ts). */
  pilotMode?: boolean
}

function prefsFile(): string {
  return join(dirname(currentDbPath()), 'ui-prefs.json')
}

function readStored(): StoredPrefs {
  try {
    if (existsSync(prefsFile())) {
      const raw = JSON.parse(readFileSync(prefsFile(), 'utf8'))
      return {
        language: raw.language === 'en' || raw.language === 'zh' ? raw.language : '',
        terminology: raw.terminology && typeof raw.terminology === 'object' ? raw.terminology : {},
        appName: cleanAppName(raw.appName),
        pilotMode: raw.pilotMode === true
      }
    }
  } catch {
    // Unreadable: fall back to the computer's language and the usual words.
  }
  return { language: '', terminology: {}, appName: '', pilotMode: false }
}

/** The copy of the pilotMode setting, for before the database can be read. */
export function storedPilotMode(): boolean {
  return readStored().pilotMode === true
}

/** The language chosen here (or the computer's own) and the school's words. */
export function readUiPrefs(): UiPrefs {
  const stored = readStored()
  return {
    language: stored.language || languageFromLocale(app.getLocale()),
    terminology: stored.terminology,
    appName: stored.appName
  }
}

/** Records a change ('' language goes back to following the computer) and switches the
 * main process's own text (dialogs, error messages, audit log) to it. */
export function saveUiPrefs(patch: Partial<StoredPrefs>): void {
  const next = { ...readStored(), ...patch }
  try {
    writeFileSync(prefsFile(), JSON.stringify(next))
  } catch (err) {
    console.error('Couldn’t save the interface language:', err)
  }
  applyUiPrefs()
}

function applyUiPrefs(): void {
  const prefs = readUiPrefs()
  setUiLanguage(prefs.language)
  setTerminology(prefs.terminology)
}

/** The file is a copy of four settings, kept for before the database opens. Once it's
 * open (after a restore, say, or an older copy), make the file match the settings.
 * Returns true if anything changed, so open windows can reload. */
export function syncUiPrefsWithSettings(settings: {
  uiLanguage: UiLanguage | ''
  terminology: Terminology
  appDisplayName?: string
  pilotMode?: boolean
}): boolean {
  const stored = readStored()
  const wanted: StoredPrefs = {
    language: settings.uiLanguage,
    terminology: settings.terminology ?? {},
    appName: cleanAppName(settings.appDisplayName),
    pilotMode: settings.pilotMode === true
  }
  if (JSON.stringify(stored) === JSON.stringify(wanted)) return false
  saveUiPrefs(wanted)
  // Only the window's words need a reload; the pilot copy is read by the main process.
  const shown = (p: StoredPrefs): string => JSON.stringify([p.language, p.terminology, p.appName])
  return shown(stored) !== shown(wanted)
}

export function initUiLanguage(): void {
  applyUiPrefs()
  // Answered synchronously, so the preload has it before the page's scripts run.
  ipcMain.on(CHANNEL, (event) => {
    event.returnValue = isTrustedIpcSender(event) ? readUiPrefs() : null
  })
}
