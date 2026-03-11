import { ipcMain, BrowserWindow } from 'electron'
import { ElectronPtyManager } from '../platform/electron-pty'

export function registerPtyHandlers(
  ptyManager: ElectronPtyManager,
  mainWindow: BrowserWindow
): void {
  ipcMain.handle('pty:create', async (_event, taskId: string, paneId: string, cwd: string) => {
    return ptyManager.create(taskId, paneId, cwd)
  })

  ipcMain.handle('pty:write', async (_event, sessionId: string, data: string) => {
    await ptyManager.write(sessionId, data)
  })

  ipcMain.handle('pty:resize', async (_event, sessionId: string, cols: number, rows: number) => {
    await ptyManager.resize(sessionId, cols, rows)
  })

  ipcMain.handle('pty:destroy', async (_event, sessionId: string) => {
    await ptyManager.destroy(sessionId)
  })

  // Forward PTY data to the renderer process
  ptyManager.onData((sessionId: string, data: string) => {
    mainWindow.webContents.send('pty:data', sessionId, data)
  })
}
