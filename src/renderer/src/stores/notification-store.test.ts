import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNotificationStore } from '@renderer/stores/notification-store'
import type { AppNotification } from '@shared/types'

// Mock window.api
const mockApi = {
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markNotificationsByTaskRead: vi.fn(),
  markNotificationsByTaskIds: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  clearNotifications: vi.fn(),
  appendNotification: vi.fn()
}

Object.defineProperty(globalThis, 'window', {
  value: { api: mockApi },
  writable: true
})

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'notif_1',
    title: 'Test notification',
    body: 'Some body text',
    taskId: 'tsk_abc',
    read: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('useNotificationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useNotificationStore.setState({
      notifications: [],
      loading: false
    })
  })

  describe('loadNotifications', () => {
    it('loads notifications from the API', async () => {
      const notifications = [
        makeNotification({ id: 'n1' }),
        makeNotification({ id: 'n2', read: true })
      ]
      mockApi.listNotifications.mockResolvedValue(notifications)

      await useNotificationStore.getState().loadNotifications()

      expect(mockApi.listNotifications).toHaveBeenCalled()
      expect(useNotificationStore.getState().notifications).toEqual(notifications)
    })

    it('silently ignores errors (project may not be initialized)', async () => {
      mockApi.listNotifications.mockRejectedValue(new Error('Not initialized'))

      await useNotificationStore.getState().loadNotifications()

      expect(useNotificationStore.getState().notifications).toEqual([])
    })
  })

  describe('markRead', () => {
    it('marks a specific notification as read', async () => {
      const n1 = makeNotification({ id: 'n1', read: false })
      const n2 = makeNotification({ id: 'n2', read: false })
      useNotificationStore.setState({ notifications: [n1, n2] })
      mockApi.markNotificationRead.mockResolvedValue(undefined)

      await useNotificationStore.getState().markRead('n1')

      expect(mockApi.markNotificationRead).toHaveBeenCalledWith('n1')
      const notifications = useNotificationStore.getState().notifications
      expect(notifications[0].read).toBe(true)
      expect(notifications[1].read).toBe(false)
    })

    it('does not change other notifications', async () => {
      const n1 = makeNotification({ id: 'n1', read: false })
      const n2 = makeNotification({ id: 'n2', read: false, title: 'Other' })
      useNotificationStore.setState({ notifications: [n1, n2] })
      mockApi.markNotificationRead.mockResolvedValue(undefined)

      await useNotificationStore.getState().markRead('n1')

      const notifications = useNotificationStore.getState().notifications
      expect(notifications[1].title).toBe('Other')
      expect(notifications[1].read).toBe(false)
    })
  })

  describe('markReadByTaskId', () => {
    it('marks all notifications for a given taskId as read', async () => {
      const n1 = makeNotification({ id: 'n1', taskId: 'tsk_a', read: false })
      const n2 = makeNotification({ id: 'n2', taskId: 'tsk_a', read: false })
      const n3 = makeNotification({ id: 'n3', taskId: 'tsk_b', read: false })
      useNotificationStore.setState({ notifications: [n1, n2, n3] })
      mockApi.markNotificationsByTaskRead.mockResolvedValue(undefined)

      await useNotificationStore.getState().markReadByTaskId('tsk_a')

      expect(mockApi.markNotificationsByTaskRead).toHaveBeenCalledWith('tsk_a')
      const notifications = useNotificationStore.getState().notifications
      expect(notifications[0].read).toBe(true)
      expect(notifications[1].read).toBe(true)
      expect(notifications[2].read).toBe(false)
    })

    it('does nothing when no notifications match the taskId', async () => {
      const n1 = makeNotification({ id: 'n1', taskId: 'tsk_other', read: false })
      useNotificationStore.setState({ notifications: [n1] })
      mockApi.markNotificationsByTaskRead.mockResolvedValue(undefined)

      await useNotificationStore.getState().markReadByTaskId('tsk_nonexistent')

      expect(useNotificationStore.getState().notifications[0].read).toBe(false)
    })
  })

  describe('markReadByTaskIds', () => {
    it('marks notifications for multiple taskIds as read in a single batch', async () => {
      const n1 = makeNotification({ id: 'n1', taskId: 'tsk_a', read: false })
      const n2 = makeNotification({ id: 'n2', taskId: 'tsk_b', read: false })
      const n3 = makeNotification({ id: 'n3', taskId: 'tsk_c', read: false })
      useNotificationStore.setState({ notifications: [n1, n2, n3] })
      mockApi.markNotificationsByTaskIds.mockResolvedValue(undefined)

      await useNotificationStore.getState().markReadByTaskIds(['tsk_a', 'tsk_b'])

      expect(mockApi.markNotificationsByTaskIds).toHaveBeenCalledWith(['tsk_a', 'tsk_b'])
      const notifications = useNotificationStore.getState().notifications
      expect(notifications[0].read).toBe(true)
      expect(notifications[1].read).toBe(true)
      expect(notifications[2].read).toBe(false)
    })

    it('handles empty taskIds array', async () => {
      const n1 = makeNotification({ id: 'n1', taskId: 'tsk_a', read: false })
      useNotificationStore.setState({ notifications: [n1] })
      mockApi.markNotificationsByTaskIds.mockResolvedValue(undefined)

      await useNotificationStore.getState().markReadByTaskIds([])

      expect(useNotificationStore.getState().notifications[0].read).toBe(false)
    })
  })

  describe('markAllRead', () => {
    it('marks all notifications as read', async () => {
      const n1 = makeNotification({ id: 'n1', read: false })
      const n2 = makeNotification({ id: 'n2', read: false })
      const n3 = makeNotification({ id: 'n3', read: true })
      useNotificationStore.setState({ notifications: [n1, n2, n3] })
      mockApi.markAllNotificationsRead.mockResolvedValue(undefined)

      await useNotificationStore.getState().markAllRead()

      expect(mockApi.markAllNotificationsRead).toHaveBeenCalled()
      const notifications = useNotificationStore.getState().notifications
      expect(notifications.every((n) => n.read)).toBe(true)
    })

    it('works with empty notifications list', async () => {
      mockApi.markAllNotificationsRead.mockResolvedValue(undefined)

      await useNotificationStore.getState().markAllRead()

      expect(useNotificationStore.getState().notifications).toEqual([])
    })
  })

  describe('clearAll', () => {
    it('clears all notifications', async () => {
      const n1 = makeNotification({ id: 'n1' })
      const n2 = makeNotification({ id: 'n2' })
      useNotificationStore.setState({ notifications: [n1, n2] })
      mockApi.clearNotifications.mockResolvedValue(undefined)

      await useNotificationStore.getState().clearAll()

      expect(mockApi.clearNotifications).toHaveBeenCalled()
      expect(useNotificationStore.getState().notifications).toEqual([])
    })

    it('works when already empty', async () => {
      mockApi.clearNotifications.mockResolvedValue(undefined)

      await useNotificationStore.getState().clearAll()

      expect(useNotificationStore.getState().notifications).toEqual([])
    })
  })

  describe('unreadCount', () => {
    it('returns count of unread notifications', () => {
      const n1 = makeNotification({ id: 'n1', read: false })
      const n2 = makeNotification({ id: 'n2', read: true })
      const n3 = makeNotification({ id: 'n3', read: false })
      useNotificationStore.setState({ notifications: [n1, n2, n3] })

      expect(useNotificationStore.getState().unreadCount()).toBe(2)
    })

    it('returns 0 when all are read', () => {
      const n1 = makeNotification({ id: 'n1', read: true })
      const n2 = makeNotification({ id: 'n2', read: true })
      useNotificationStore.setState({ notifications: [n1, n2] })

      expect(useNotificationStore.getState().unreadCount()).toBe(0)
    })

    it('returns 0 when no notifications exist', () => {
      expect(useNotificationStore.getState().unreadCount()).toBe(0)
    })
  })

  describe('markUnread', () => {
    it('creates an unread notification for the task and adds it to the store', async () => {
      mockApi.appendNotification.mockResolvedValue(undefined)

      await useNotificationStore.getState().markUnread('tsk_abc', 'My Task')

      expect(mockApi.appendNotification).toHaveBeenCalledTimes(1)
      const calledWith = mockApi.appendNotification.mock.calls[0][0]
      expect(calledWith.taskId).toBe('tsk_abc')
      expect(calledWith.title).toBe('My Task')
      expect(calledWith.body).toBe('Marked as unread')
      expect(calledWith.read).toBe(false)
      expect(calledWith.id).toMatch(/^ntf_/)

      const notifications = useNotificationStore.getState().notifications
      expect(notifications).toHaveLength(1)
      expect(notifications[0].taskId).toBe('tsk_abc')
      expect(notifications[0].read).toBe(false)
    })

    it('appends to existing notifications without affecting them', async () => {
      const existing = makeNotification({ id: 'n1', read: true })
      useNotificationStore.setState({ notifications: [existing] })
      mockApi.appendNotification.mockResolvedValue(undefined)

      await useNotificationStore.getState().markUnread('tsk_xyz', 'Another Task')

      const notifications = useNotificationStore.getState().notifications
      expect(notifications).toHaveLength(2)
      expect(notifications[0]).toEqual(existing)
      expect(notifications[1].taskId).toBe('tsk_xyz')
      expect(notifications[1].read).toBe(false)
    })
  })
})
