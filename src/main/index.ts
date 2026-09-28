import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { DATA_FOLDER_NAME } from '@shared/branding'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { initDb } from './db/client'
import { registerIpcHandlers } from './ipc/register'
import { initUiLanguage, syncUiPrefsWithSettings } from './i18n'
import { getSettings } from './repositories/settingsRepo'
import { applyWindowIcon, createMainWindow } from './windows'
import { applyManagedSchoolPack } from './services/managedSchoolPack'
import { createAutoBackupOnLaunch, startDailyAutoBackups } from './services/backup'
import { checkAndRecordDeviceSync } from './services/deviceSync'
import { stopExitTicketServer } from './services/exitTicketServer'
import { purgeOldDeletedAuditEntries } from './repositories/auditLog'
import { isProtected, startAutoLock, whenFirstUnlocked } from './services/security'
import { installPendingUpdateOnLaunch, startAutomaticUpdateChecks } from './services/selfUpdate'
import { startUsagePings } from './services/usagePing'
import { toWindowError } from './services/errorLog'
import {
  clearSampleSchoolIfAsked,
  isSampleSchool,
  seedSampleSchoolIfEmpty
} from './services/sampleSchool'

// Teachers' data lives in "<app data>/EduBoard" (Windows %APPDATA%, macOS Application
// Support, Linux ~/.config). That folder is named after the product by default; pinning it
// keeps everyone's classes where they are even if the app is renamed one day.
if (app.isPackaged) app.setPath('userData', join(app.getPath('appData'), DATA_FOLDER_NAME))

// A promise nobody waited on failed: log it with a reference (it never reached a screen).
process.on('unhandledRejection', (reason) => {
  toWindowError(reason, 'background')
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.eduboard.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initUiLanguage()
  registerIpcHandlers()

  // Everything that needs the database open.
  const startWithDatabase = (): void => {
    // The school's pack for everyone on this computer, if its IT installed one.
    applyManagedSchoolPack()
    // The language and the school's words may differ in this database (a restore, say).
    if (syncUiPrefsWithSettings(getSettings())) {
      for (const win of BrowserWindow.getAllWindows()) win.webContents.reload()
    }
    if (!isSampleSchool()) createAutoBackupOnLaunch()
    // An update downloaded last session installs now, before anything else opens;
    // EduBoard then reopens as the new version.
    const installing = installPendingUpdateOnLaunch(() => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
      carryOn()
    })
    if (installing) return
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    applyWindowIcon(getSettings().schoolLogo)
    carryOn()
  }
  const carryOn = (): void => {
    if (isSampleSchool()) {
      // Made-up data: no backups of it, and it never counts as a copy in use.
      startAutomaticUpdateChecks()
      return
    }
    startDailyAutoBackups()
    purgeOldDeletedAuditEntries()
    checkAndRecordDeviceSync()
    startAutomaticUpdateChecks()
    startAutoLock()
    startUsagePings()
  }

  if (isProtected()) {
    // Password protection: the window opens on the lock screen, and the rest of startup
    // waits until the database is unlocked.
    whenFirstUnlocked(startWithDatabase)
    createMainWindow()
  } else {
    clearSampleSchoolIfAsked()
    initDb()
    seedSampleSchoolIfEmpty()
    startWithDatabase()
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// The exit-ticket HTTP server (see services/exitTicketServer.ts) is only started
// lazily when a teacher opens an exit-ticket session, but must be shut down cleanly
// on quit rather than left to the OS to reclaim.
app.on('before-quit', () => {
  stopExitTicketServer()
})
