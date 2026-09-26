import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { initDb } from './db/client'
import { registerIpcHandlers } from './ipc/register'
import { createMainWindow } from './windows'
import { createAutoBackupOnLaunch, startDailyAutoBackups } from './services/backup'
import { checkAndRecordDeviceSync } from './services/deviceSync'
import { stopExitTicketServer } from './services/exitTicketServer'
import { purgeOldDeletedAuditEntries } from './repositories/auditLog'

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.eduboard.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDb()
  createAutoBackupOnLaunch()
  startDailyAutoBackups()
  purgeOldDeletedAuditEntries()
  checkAndRecordDeviceSync()
  registerIpcHandlers()
  createMainWindow()

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
