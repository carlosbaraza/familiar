import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectSidebar } from './ProjectSidebar'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import type { AppNotification } from '@shared/types'

// Mock window.api
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).api = {
  setProjectRoot: vi.fn().mockResolvedValue(true),
  readProjectState: vi.fn().mockResolvedValue(null),
  isInitialized: vi.fn().mockResolvedValue(true),
  openDirectory: vi.fn().mockResolvedValue(null),
  workspaceAddProject: vi.fn().mockResolvedValue(undefined),
  workspaceRemoveProject: vi.fn().mockResolvedValue(undefined),
  workspaceSetActiveProject: vi.fn().mockResolvedValue(undefined),
  workspaceGetOpenProjects: vi.fn().mockResolvedValue([]),
  workspaceGetActiveProject: vi.fn().mockResolvedValue(null),
  workspaceGetConfig: vi.fn().mockResolvedValue({ workspaces: [], lastWorkspaceId: null }),
  listNotifications: vi.fn().mockResolvedValue([]),
  listAllNotifications: vi.fn().mockResolvedValue([])
}

beforeEach(() => {
  vi.clearAllMocks()
  useNotificationStore.setState({ notifications: [], workspaceNotifications: [] })
})

function makeNotification(overrides: Partial<AppNotification & { projectPath?: string }> = {}): AppNotification & { projectPath?: string } {
  return {
    id: `notif_${Math.random().toString(36).slice(2)}`,
    title: 'Test',
    body: 'body',
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

describe('ProjectSidebar', () => {
  it('returns null when sidebarVisible is false', () => {
    useWorkspaceStore.setState({
      sidebarVisible: false,
      openProjects: [],
      activeProjectPath: null,
      sidebarExpanded: false
    })

    const { container } = render(<ProjectSidebar />)
    expect(container.innerHTML).toBe('')
  })

  it('renders sidebar when visible with project icons', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        { path: '/tmp/alpha', name: 'alpha' },
        { path: '/tmp/beta', name: 'beta' }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: false
    })

    render(<ProjectSidebar />)
    expect(screen.getByTestId('project-sidebar')).toBeTruthy()
  })

  it('shows project names when expanded', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        { path: '/tmp/alpha', name: 'alpha' },
        { path: '/tmp/beta', name: 'beta' }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: true
    })

    render(<ProjectSidebar />)
    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByText('beta')).toBeTruthy()
  })

  it('highlights the active project', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        { path: '/tmp/alpha', name: 'alpha' },
        { path: '/tmp/beta', name: 'beta' }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: false
    })

    render(<ProjectSidebar />)
    const activeItem = screen.getByTestId('project-item-alpha')
    expect(activeItem.className).toContain('Active')
  })

  it('shows unread notification badge on collapsed sidebar for each project', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        { path: '/tmp/alpha', name: 'alpha' },
        { path: '/tmp/beta', name: 'beta' }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: false
    })
    useNotificationStore.setState({
      workspaceNotifications: [
        makeNotification({ read: false, projectPath: '/tmp/alpha' }),
        makeNotification({ read: false, projectPath: '/tmp/alpha' }),
        makeNotification({ read: true, projectPath: '/tmp/alpha' }),
        makeNotification({ read: false, projectPath: '/tmp/beta' })
      ]
    })

    render(<ProjectSidebar />)
    expect(screen.getByTestId('badge-alpha')).toBeTruthy()
    expect(screen.getByTestId('badge-alpha').textContent).toBe('2')
    // Non-active project should also show its unread count
    expect(screen.getByTestId('badge-beta')).toBeTruthy()
    expect(screen.getByTestId('badge-beta').textContent).toBe('1')
  })

  it('does not show badge when no unread notifications', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        { path: '/tmp/alpha', name: 'alpha' },
        { path: '/tmp/beta', name: 'beta' }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: false
    })
    useNotificationStore.setState({
      workspaceNotifications: [makeNotification({ read: true, projectPath: '/tmp/alpha' })]
    })

    render(<ProjectSidebar />)
    expect(screen.queryByTestId('badge-alpha')).toBeNull()
    expect(screen.queryByTestId('badge-beta')).toBeNull()
  })

  it('does not show badge when sidebar is expanded', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        { path: '/tmp/alpha', name: 'alpha' }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: true
    })
    useNotificationStore.setState({
      workspaceNotifications: [makeNotification({ read: false, projectPath: '/tmp/alpha' })]
    })

    render(<ProjectSidebar />)
    expect(screen.queryByTestId('badge-alpha')).toBeNull()
  })

  it('shows unread count text when expanded with unread notifications', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        { path: '/tmp/alpha', name: 'alpha' }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: true
    })
    useNotificationStore.setState({
      workspaceNotifications: [
        makeNotification({ read: false, projectPath: '/tmp/alpha' }),
        makeNotification({ read: false, projectPath: '/tmp/alpha' }),
        makeNotification({ read: true, projectPath: '/tmp/alpha' })
      ]
    })

    render(<ProjectSidebar />)
    expect(screen.getByText('2 unread')).toBeTruthy()
  })

  it('does not show unread text when expanded with no unread', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        { path: '/tmp/alpha', name: 'alpha' }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: true
    })
    useNotificationStore.setState({
      workspaceNotifications: [makeNotification({ read: true, projectPath: '/tmp/alpha' })]
    })

    render(<ProjectSidebar />)
    expect(screen.queryByText(/unread/)).toBeNull()
  })

  it('renders add project button', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        { path: '/tmp/alpha', name: 'alpha' },
        { path: '/tmp/beta', name: 'beta' }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: false
    })

    render(<ProjectSidebar />)
    expect(screen.getByTestId('add-project-button')).toBeTruthy()
  })

  it('renders toggle button', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        { path: '/tmp/alpha', name: 'alpha' }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: false
    })

    render(<ProjectSidebar />)
    expect(screen.getByTestId('sidebar-toggle')).toBeTruthy()
  })

  it('collapsed sidebar has collapsed class', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        { path: '/tmp/alpha', name: 'alpha' },
        { path: '/tmp/beta', name: 'beta' }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: false
    })

    render(<ProjectSidebar />)
    const sidebar = screen.getByTestId('project-sidebar')
    expect(sidebar.className).toContain('Collapsed')
  })

  it('expanded sidebar has expanded class', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        { path: '/tmp/alpha', name: 'alpha' },
        { path: '/tmp/beta', name: 'beta' }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: true
    })

    render(<ProjectSidebar />)
    const sidebar = screen.getByTestId('project-sidebar')
    expect(sidebar.className).toContain('Expanded')
  })

  it('parent project badge shows only its own unread count, not worktree counts', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        {
          path: '/tmp/alpha',
          name: 'alpha',
          worktrees: [
            { path: '/tmp/alpha/.familiar/worktrees/wt1', branch: 'wt1', slug: 'wt1', isMain: false }
          ]
        }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: false
    })
    useNotificationStore.setState({
      workspaceNotifications: [
        makeNotification({ read: false, projectPath: '/tmp/alpha' }),
        makeNotification({ read: false, projectPath: '/tmp/alpha/.familiar/worktrees/wt1' })
      ]
    })

    render(<ProjectSidebar />)
    // Parent badge should show only 1 (its own), not 2
    expect(screen.getByTestId('badge-alpha').textContent).toBe('1')
  })

  it('shows unread text on worktree items when sidebar is expanded', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        {
          path: '/tmp/alpha',
          name: 'alpha',
          worktrees: [
            { path: '/tmp/alpha/.familiar/worktrees/wt1', branch: 'wt1', slug: 'wt1', isMain: false }
          ]
        }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: true
    })
    useNotificationStore.setState({
      workspaceNotifications: [
        makeNotification({ read: false, projectPath: '/tmp/alpha/.familiar/worktrees/wt1' }),
        makeNotification({ read: false, projectPath: '/tmp/alpha/.familiar/worktrees/wt1' })
      ]
    })

    render(<ProjectSidebar />)
    // Worktree should show its own unread count
    const worktreeItem = screen.getByTestId('worktree-item-wt1')
    expect(worktreeItem.textContent).toContain('2 unread')
    // Parent has 0 own unread, so only worktree shows "2 unread"
    expect(screen.getAllByText('2 unread').length).toBe(1)
  })

  describe('keyboard navigation', () => {
    beforeEach(() => {
      useWorkspaceStore.setState({
        sidebarVisible: true,
        openProjects: [
          {
            path: '/tmp/alpha',
            name: 'alpha',
            worktrees: [
              { path: '/tmp/alpha-wt1', branch: 'feat', slug: 'wt1', isMain: false }
            ]
          },
          { path: '/tmp/beta', name: 'beta' }
        ],
        activeProjectPath: '/tmp/alpha',
        sidebarExpanded: true
      })
    })

    it('highlights the active project when sidebar is focused', () => {
      useUIStore.setState({ sidebarFocused: true, focusedSidebarIndex: 0 })
      render(<ProjectSidebar />)
      const alphaItem = screen.getByTestId('project-item-alpha')
      expect(alphaItem.className).toContain('KeyboardFocused')
    })

    it('moves focus down with ArrowDown', () => {
      useUIStore.setState({ sidebarFocused: true, focusedSidebarIndex: 0 })
      render(<ProjectSidebar />)
      fireEvent.keyDown(window, { key: 'ArrowDown' })
      expect(useUIStore.getState().focusedSidebarIndex).toBe(1)
    })

    it('moves focus up with ArrowUp', () => {
      useUIStore.setState({ sidebarFocused: true, focusedSidebarIndex: 0 })
      render(<ProjectSidebar />)
      // Move down twice first (alpha→wt1→beta)
      fireEvent.keyDown(window, { key: 'ArrowDown' })
      fireEvent.keyDown(window, { key: 'ArrowDown' })
      expect(useUIStore.getState().focusedSidebarIndex).toBe(2)
      fireEvent.keyDown(window, { key: 'ArrowUp' })
      expect(useUIStore.getState().focusedSidebarIndex).toBe(1)
    })

    it('does not go below last item', () => {
      // 3 items: alpha, wt1, beta
      useUIStore.setState({ sidebarFocused: true, focusedSidebarIndex: 0 })
      render(<ProjectSidebar />)
      fireEvent.keyDown(window, { key: 'ArrowDown' })
      fireEvent.keyDown(window, { key: 'ArrowDown' })
      fireEvent.keyDown(window, { key: 'ArrowDown' }) // should stay at 2
      expect(useUIStore.getState().focusedSidebarIndex).toBe(2)
    })

    it('does not go above first item', () => {
      useUIStore.setState({ sidebarFocused: true, focusedSidebarIndex: 0 })
      render(<ProjectSidebar />)
      fireEvent.keyDown(window, { key: 'ArrowUp' })
      expect(useUIStore.getState().focusedSidebarIndex).toBe(0)
    })

    it('Escape clears sidebar focus', () => {
      useUIStore.setState({ sidebarFocused: true, focusedSidebarIndex: 0 })
      render(<ProjectSidebar />)
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(useUIStore.getState().sidebarFocused).toBe(false)
    })

    it('supports vim keys j and k', () => {
      useUIStore.setState({ sidebarFocused: true, focusedSidebarIndex: 0 })
      render(<ProjectSidebar />)
      fireEvent.keyDown(window, { key: 'j' })
      expect(useUIStore.getState().focusedSidebarIndex).toBe(1)
      fireEvent.keyDown(window, { key: 'k' })
      expect(useUIStore.getState().focusedSidebarIndex).toBe(0)
    })

    it('does not apply keyboard focus class when sidebar is not focused', () => {
      useUIStore.setState({ sidebarFocused: false, focusedSidebarIndex: 0 })
      render(<ProjectSidebar />)
      const alphaItem = screen.getByTestId('project-item-alpha')
      expect(alphaItem.className).not.toContain('KeyboardFocused')
    })
  })

  it('does not show worktree badge when worktree has no unread', () => {
    useWorkspaceStore.setState({
      sidebarVisible: true,
      openProjects: [
        {
          path: '/tmp/alpha',
          name: 'alpha',
          worktrees: [
            { path: '/tmp/alpha/.familiar/worktrees/wt1', branch: 'wt1', slug: 'wt1', isMain: false }
          ]
        }
      ],
      activeProjectPath: '/tmp/alpha',
      sidebarExpanded: true
    })
    useNotificationStore.setState({
      workspaceNotifications: [
        makeNotification({ read: true, projectPath: '/tmp/alpha/.familiar/worktrees/wt1' })
      ]
    })

    render(<ProjectSidebar />)
    const worktreeItem = screen.getByTestId('worktree-item-wt1')
    expect(worktreeItem.textContent).not.toContain('unread')
  })
})
