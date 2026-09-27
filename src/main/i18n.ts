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

const CHANNEL = 'i18n:prefs'

export interface UiPrefs {
  language: UiLanguage
  terminology: Terminology
}

interface StoredPrefs {
  language: UiLanguage | ''
  terminology: Terminology
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
        terminology: raw.terminology && typeof raw.terminology === 'object' ? raw.terminology : {}
      }
    }
  } catch {
    // Unreadable: fall back to the computer's language and the usual words.
  }
  return { language: '', terminology: {} }
}

/** The language chosen here (or the computer's own) and the school's words. */
export function readUiPrefs(): UiPrefs {
  const stored = readStored()
  return {
    language: stored.language || languageFromLocale(app.getLocale()),
    terminology: stored.terminology
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

/** The file is a copy of two settings, kept for before the database opens. Once it's
 * open (after a restore, say, or an older copy), make the file match the settings.
 * Returns true if anything changed, so open windows can reload. */
export function syncUiPrefsWithSettings(settings: {
  uiLanguage: UiLanguage | ''
  terminology: Terminology
}): boolean {
  const stored = readStored()
  const wanted: StoredPrefs = {
    language: settings.uiLanguage,
    terminology: settings.terminology ?? {}
  }
  if (JSON.stringify(stored) === JSON.stringify(wanted)) return false
  saveUiPrefs(wanted)
  return true
}

export function initUiLanguage(): void {
  applyUiPrefs()
  // Answered synchronously, so the preload has it before the page's scripts run.
  ipcMain.on(CHANNEL, (event) => {
    event.returnValue = readUiPrefs()
  })
}
