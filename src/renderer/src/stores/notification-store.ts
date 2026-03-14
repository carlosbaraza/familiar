import { create } from 'zustand'
import type { AppNotification } from '@shared/types'
import { generateNotificationId } from '@shared/utils/id-generator'

/** Notification with optional project source for workspace-wide views */
export type WorkspaceNotification = AppNotification & { projectPath?: string }

interface NotificationState {
  /** Notifications for the active project (used by task cards, etc.) */
  notifications: AppNotification[]
  /** Notifications from ALL open projects (used by navbar, widget, sidebar) */
  workspaceNotifications: WorkspaceNotification[]
  loading: boolean

  loadNotifications: () => Promise<void>
  loadWorkspaceNotifications: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markReadByTaskId: (taskId: string) => Promise<void>
  markReadByTaskIds: (taskIds: string[]) => Promise<void>
  markAllRead: () => Promise<void>
  clearAll: () => Promise<void>
  unreadCount: () => number
  workspaceUnreadCount: () => number
  workspaceUnreadCountForProject: (projectPath: string) => number
  markUnread: (taskId: string, taskTitle: string) => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  workspaceNotifications: [],
  loading: false,

  loadNotifications: async () => {
    try {
      const notifications = await window.api.listNotifications()
      set({ notifications })
    } catch {
      // ignore — project may not be initialized
    }
  },

  loadWorkspaceNotifications: async () => {
    try {
      const workspaceNotifications = await window.api.listAllNotifications()
      set({ workspaceNotifications })
    } catch {
      // ignore — may not have multiple projects
    }
  },

  markRead: async (id: string) => {
    await window.api.markNotificationRead(id)
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      workspaceNotifications: state.workspaceNotifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
    }))
  },

  markReadByTaskId: async (taskId: string) => {
    await window.api.markNotificationsByTaskRead(taskId)
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.taskId === taskId ? { ...n, read: true } : n
      ),
      workspaceNotifications: state.workspaceNotifications.map((n) =>
        n.taskId === taskId ? { ...n, read: true } : n
      )
    }))
  },

  markReadByTaskIds: async (taskIds: string[]) => {
    await window.api.markNotificationsByTaskIds(taskIds)
    const idSet = new Set(taskIds)
    set((state) => ({
      notifications: state.notifications.map((n) =>
        idSet.has(n.taskId) ? { ...n, read: true } : n
      ),
      workspaceNotifications: state.workspaceNotifications.map((n) =>
        idSet.has(n.taskId) ? { ...n, read: true } : n
      )
    }))
  },

  markAllRead: async () => {
    await window.api.markAllNotificationsRead()
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      workspaceNotifications: state.workspaceNotifications.map((n) => ({ ...n, read: true }))
    }))
  },

  clearAll: async () => {
    await window.api.clearNotifications()
    set({ notifications: [] })
  },

  unreadCount: () => {
    return get().notifications.filter((n) => !n.read).length
  },

  workspaceUnreadCount: () => {
    return get().workspaceNotifications.filter((n) => !n.read).length
  },

  workspaceUnreadCountForProject: (projectPath: string) => {
    return get().workspaceNotifications.filter(
      (n) => !n.read && n.projectPath === projectPath
    ).length
  },

  markUnread: async (taskId: string, taskTitle: string) => {
    const notification: AppNotification = {
      id: generateNotificationId(),
      title: taskTitle,
      body: 'Marked as unread',
      taskId,
      read: false,
      createdAt: new Date().toISOString()
    }
    await window.api.appendNotification(notification)
    set((state) => ({
      notifications: [...state.notifications, notification]
    }))
  }
}))
