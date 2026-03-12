import { ipcMain } from 'electron'
import { ElectronTmuxManager } from '../platform/electron-tmux'
import type { DataService } from '../services/data-service'

export function registerTmuxHandlers(tmuxManager: ElectronTmuxManager, dataService: DataService): void {
  ipcMain.handle('tmux:list', async () => {
    return tmuxManager.listSessions()
  })

  ipcMain.handle('tmux:attach', async (_event, name: string) => {
    await tmuxManager.attachSession(name)
  })

  ipcMain.handle('tmux:detach', async (_event, name: string) => {
    await tmuxManager.detachSession(name)
  })

  ipcMain.handle('tmux:kill', async (_event, name: string) => {
    try {
      await tmuxManager.killSession(name)
    } catch {
      // Session may already be dead — that's fine
    }
  })

  ipcMain.handle('tmux:has', async (_event, name: string) => {
    return tmuxManager.hasSession(name)
  })

  ipcMain.handle(
    'tmux:send-keys',
    async (_event, sessionName: string, keys: string, pressEnter: boolean) => {
      await tmuxManager.sendKeys(sessionName, keys, pressEnter)
    }
  )

  ipcMain.handle('tmux:warmup', async (_event, taskId: string) => {
    const sessionName = `kanban-${taskId}`
    const exists = await tmuxManager.hasSession(sessionName)
    if (exists) return

    const projectRoot = dataService.getProjectRoot()
    const env = {
      KANBAN_TASK_ID: taskId,
      KANBAN_PROJECT_ROOT: projectRoot
    }

    await tmuxManager.createSession(sessionName, projectRoot, env)

    try {
      const settings = await dataService.readSettings()
      if (settings.defaultCommand) {
        await tmuxManager.sendKeys(sessionName, settings.defaultCommand)
      }
    } catch {
      // Settings not available — skip default command
    }
  })
}
