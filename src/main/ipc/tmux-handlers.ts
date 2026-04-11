import { ipcMain } from 'electron'
import { ElectronTmuxManager } from '../platform/electron-tmux'
import type { DataService } from '../services/data-service'
import { ensureSessionCopied, resolveAgentCommand } from '../services/claude-session'

export function registerTmuxHandlers(tmuxManager: ElectronTmuxManager, dataService: DataService): void {
  // Track in-progress warmups to prevent duplicate concurrent calls.
  // Maps taskId → promise so concurrent callers can await the same warmup.
  const warmupInProgress = new Map<string, Promise<void>>()
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

  ipcMain.handle('tmux:warmup', (_event, taskId: string, copySessionFrom?: string) => {
    // If a warmup is already in progress for this task, return its promise
    // so all callers await the same completion.
    const existing = warmupInProgress.get(taskId)
    if (existing) return existing

    const promise = (async () => {
      const sessionName = `familiar-${taskId}`
      const exists = await tmuxManager.hasSession(sessionName)
      if (exists) return

      const projectRoot = dataService.getProjectRoot()
      const env = {
        FAMILIAR_TASK_ID: taskId,
        FAMILIAR_PROJECT_ROOT: projectRoot,
        FAMILIAR_SETTINGS_PATH: `${projectRoot}/.familiar/settings.json`
      }

      // Copy parent's Claude session file before creating the tmux session
      if (copySessionFrom) {
        ensureSessionCopied(taskId, copySessionFrom, projectRoot)
      }

      await tmuxManager.createSession(sessionName, projectRoot, env)

      // Resolve agent command (uses agent profile's defaultCommand if task.agentId is set,
      // otherwise falls back to global settings.defaultCommand), then warm up.
      // Await warmup so the IPC caller knows when the session is fully ready.
      let command: string | undefined
      try {
        command = await resolveAgentCommand(dataService, taskId, projectRoot)
      } catch {
        // Resolution failed — skip default command
      }

      await tmuxManager.warmupSession(sessionName, env, command)
    })()

    warmupInProgress.set(taskId, promise)
    promise.finally(() => warmupInProgress.delete(taskId))

    return promise
  })
}
