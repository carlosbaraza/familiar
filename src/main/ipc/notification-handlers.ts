import { ipcMain, Notification } from 'electron'
import type { DataService } from '../services/data-service'
import type { WorkspaceManager } from '../services/workspace-manager'
import type { AppNotification } from '../../shared/types'

export function registerNotificationHandlers(
  dataService: DataService,
  workspaceManager: WorkspaceManager
): void {
  ipcMain.handle('notification:send', async (_, title: string, body: string) => {
    new Notification({ title, body }).show()
  })

  ipcMain.handle('notification:list', async () => {
    return dataService.readNotifications()
  })

  // Aggregate notifications from ALL open projects in the workspace.
  // Each notification is tagged with its projectPath and a `taskVisible`
  // flag so the renderer can skip counts for orphan notifications whose
  // task has been deleted or archived (which have no card on the board).
  ipcMain.handle('notification:list-all', async () => {
    const allServices = workspaceManager.getActiveDataServices()
    const result: (AppNotification & { projectPath: string; taskVisible: boolean })[] = []
    for (const [projectPath, ds] of allServices) {
      try {
        const [notifications, state] = await Promise.all([
          ds.readNotifications(),
          ds.readProjectState().catch(() => null)
        ])
        const visibleTaskIds = new Set<string>()
        if (state) {
          for (const t of state.tasks) {
            if (t.status !== 'archived') visibleTaskIds.add(t.id)
          }
        }
        for (const n of notifications) {
          const taskVisible = !n.taskId || visibleTaskIds.has(n.taskId)
          result.push({ ...n, projectPath, taskVisible })
        }
      } catch {
        // Project may not be initialized — skip
      }
    }
    return result
  })

  ipcMain.handle('notification:mark-read', async (_, id: string) => {
    // Search all open projects (including worktrees) to find and mark the notification
    const allServices = workspaceManager.getActiveDataServices()
    for (const [, ds] of allServices) {
      try {
        await ds.markNotificationRead(id)
      } catch {
        // ignore — notification may not exist in this project
      }
    }
  })

  ipcMain.handle('notification:mark-read-by-task', async (_, taskId: string) => {
    const allServices = workspaceManager.getActiveDataServices()
    for (const [, ds] of allServices) {
      try {
        await ds.markNotificationsByTaskRead(taskId)
      } catch {
        // ignore
      }
    }
  })

  ipcMain.handle('notification:mark-read-by-tasks', async (_, taskIds: string[]) => {
    const allServices = workspaceManager.getActiveDataServices()
    for (const [, ds] of allServices) {
      try {
        await ds.markNotificationsByTaskIds(taskIds)
      } catch {
        // ignore
      }
    }
  })

  ipcMain.handle('notification:mark-all-read', async () => {
    const allServices = workspaceManager.getActiveDataServices()
    for (const [, ds] of allServices) {
      try {
        await ds.markAllNotificationsRead()
      } catch {
        // ignore
      }
    }
  })

  ipcMain.handle('notification:clear', async () => {
    await dataService.clearNotifications()
  })

  ipcMain.handle(
    'notification:append',
    async (_, notification: AppNotification) => {
      await dataService.appendNotification(notification)
    }
  )
}
