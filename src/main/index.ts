import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { initDb } from './db/client'
import { registerIpcHandlers } from './ipc/register'
import { initUiLanguage, syncUiPrefsWithSettings } from './i18n'
import { getSettings } from './repositories/settingsRepo'
import { createMainWindow } from './windows'
import { createAutoBackupOnLaunch, startDailyAutoBackups } from './services/backup'
import { checkAndRecordDeviceSync } from './services/deviceSync'
import { stopExitTicketServer } from './services/exitTicketServer'
import { purgeOldDeletedAuditEntries } from './repositories/auditLog'
import { isProtected, startAutoLock, whenFirstUnlocked } from './services/security'
import { installPendingUpdateOnLaunch, startAutomaticUpdateChecks } from './services/selfUpdate'
import { startUsagePings } from './services/usagePing'

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.eduboard.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initUiLanguage()
  registerIpcHandlers()

  // Everything that needs the database open.
  const startWithDatabase = (): void => {
    // The language and the school's words may differ in this database (a restore, say).
    if (syncUiPrefsWithSettings(getSettings())) {
      for (const win of BrowserWindow.getAllWindows()) win.webContents.reload()
    }
    createAutoBackupOnLaunch()
    // An update downloaded last session installs now, before anything else opens;
    // EduBoard then reopens as the new version.
    const installing = installPendingUpdateOnLaunch(() => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
      carryOn()
    })
    if (installing) return
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    carryOn()
  }
  const carryOn = (): void => {
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
    initDb()
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
