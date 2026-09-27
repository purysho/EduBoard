// The interface language for this computer. It lives in the settings like everything
// else, and also in a small plain file next to the database, because the lock screen
// needs it before an encrypted database can be read, and each window needs it
// synchronously before any screen code runs (see src/renderer/src/i18nInit.ts).
import { app, ipcMain } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { currentDbPath } from './db/client'
import { languageFromLocale, setUiLanguage, type UiLanguage } from '@shared/i18n'

const CHANNEL = 'i18n:language'

function languageFile(): string {
  return join(dirname(currentDbPath()), 'ui-language.txt')
}

/** The language chosen here, or the computer's own if none has been chosen. */
export function readUiLanguage(): UiLanguage {
  try {
    const saved = existsSync(languageFile()) ? readFileSync(languageFile(), 'utf8').trim() : ''
    if (saved === 'en' || saved === 'zh') return saved
  } catch {
    // Unreadable: fall back to the computer's language.
  }
  return languageFromLocale(app.getLocale())
}

/** Records a choice ('' goes back to following the computer) and switches the main
 * process's own text (dialogs, error messages) to it. */
export function saveUiLanguage(choice: UiLanguage | ''): void {
  try {
    writeFileSync(languageFile(), choice)
  } catch (err) {
    console.error('Couldn’t save the interface language:', err)
  }
  setUiLanguage(readUiLanguage())
}

export function initUiLanguage(): void {
  setUiLanguage(readUiLanguage())
  // Answered synchronously, so the preload has it before the page's scripts run.
  ipcMain.on(CHANNEL, (event) => {
    event.returnValue = readUiLanguage()
  })
}
