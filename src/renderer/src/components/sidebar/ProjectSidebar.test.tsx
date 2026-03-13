import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectSidebar } from './ProjectSidebar'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import type { AppNotification } from '@shared/types'

// Mock window.api
vi.stubGlobal('window', {
  api: {
    setProjectRoot: vi.fn().mockResolvedValue(true),
    readProjectState: vi.fn().mockResolvedValue(null),
    isInitialized: vi.fn().mockResolvedValue(true),
    openDirectory: vi.fn().mockResolvedValue(null),
    workspaceAddProject: vi.fn().mockResolvedValue(undefined),
    workspaceRemoveProject: vi.fn().mockResolvedValue(undefined),
    workspaceSetActiveProject: vi.fn().mockResolvedValue(undefined),
    workspaceGetOpenProjects: vi.fn().mockResolvedValue([]),
    workspaceGetActiveProject: vi.fn().mockResolvedValue(null),
    workspaceGetConfig: vi.fn().mockResolvedValue({ workspaces: [], lastWorkspaceId: null })
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  useNotificationStore.setState({ notifications: [] })
})

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
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

  it('shows unread notification badge on collapsed sidebar for active project', () => {
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
      notifications: [
        makeNotification({ read: false }),
        makeNotification({ read: false }),
        makeNotification({ read: true })
      ]
    })

    render(<ProjectSidebar />)
    expect(screen.getByTestId('badge-alpha')).toBeTruthy()
    expect(screen.getByTestId('badge-alpha').textContent).toBe('2')
    // Non-active project should not have a badge
    expect(screen.queryByTestId('badge-beta')).toBeNull()
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
      notifications: [makeNotification({ read: true })]
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
      notifications: [makeNotification({ read: false })]
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
      notifications: [
        makeNotification({ read: false }),
        makeNotification({ read: false }),
        makeNotification({ read: true })
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
      notifications: [makeNotification({ read: true })]
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
})
