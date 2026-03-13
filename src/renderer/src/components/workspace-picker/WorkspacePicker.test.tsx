import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { WorkspacePicker } from './WorkspacePicker'
import type { Workspace } from '@shared/types'

const now = new Date('2026-03-13T12:00:00Z')

const mockWorkspaces: Workspace[] = [
  {
    id: 'ws_1',
    name: 'Alpha Project',
    projectPaths: ['/Users/dev/alpha', '/Users/dev/alpha-api'],
    lastOpenedAt: '2026-03-13T10:00:00Z',
    createdAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'ws_2',
    name: 'Beta Suite',
    projectPaths: ['/Users/dev/beta'],
    lastOpenedAt: '2026-03-12T08:00:00Z',
    createdAt: '2026-02-15T00:00:00Z'
  },
  {
    id: 'ws_3',
    name: 'Gamma',
    projectPaths: ['/Users/dev/gamma', '/Users/dev/gamma-web', '/Users/dev/gamma-mobile'],
    lastOpenedAt: '2026-03-10T00:00:00Z',
    createdAt: '2026-01-10T00:00:00Z'
  }
]

const mockApi = {
  workspaceList: vi.fn().mockResolvedValue([]),
  workspaceOpen: vi.fn().mockResolvedValue(undefined),
  workspaceOpenSingle: vi.fn().mockResolvedValue(undefined),
  workspaceCreate: vi.fn().mockResolvedValue({ id: 'ws_new', name: 'New', projectPaths: [], lastOpenedAt: '', createdAt: '' }),
  workspaceGetConfig: vi.fn().mockResolvedValue({ workspaces: [], lastWorkspaceId: null }),
  workspaceGetOpenProjects: vi.fn().mockResolvedValue([]),
  workspaceGetActiveProject: vi.fn().mockResolvedValue(null),
  openDirectory: vi.fn().mockResolvedValue(null),
  isInitialized: vi.fn().mockResolvedValue(true),
  readProjectState: vi.fn().mockResolvedValue({ version: 1, projectName: 'test', tasks: [], columnOrder: [], labels: [] })
}

;(window as any).api = mockApi

/**
 * Helper to render WorkspacePicker with workspaces pre-loaded.
 * Sets up both the mock API and the store so the useEffect loadWorkspaces
 * call doesn't overwrite the state with an empty array.
 */
function renderWithWorkspaces(workspaces: Workspace[] = mockWorkspaces): ReturnType<typeof render> {
  mockApi.workspaceList.mockResolvedValue(workspaces)
  useWorkspaceStore.setState({ workspaces })
  let result: ReturnType<typeof render>
  // Using act to handle the useEffect loadWorkspaces call
  act(() => {
    result = render(<WorkspacePicker />)
  })
  return result!
}

describe('WorkspacePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ now })

    mockApi.workspaceList.mockResolvedValue([])

    useWorkspaceStore.setState({
      workspaces: [],
      activeWorkspace: null,
      showWorkspacePicker: true
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the workspace picker overlay', async () => {
    await act(async () => {
      render(<WorkspacePicker />)
    })
    expect(screen.getByTestId('workspace-picker')).toBeDefined()
    expect(screen.getByText('Open a Workspace')).toBeDefined()
  })

  it('renders "New Workspace" and "Open Single Project" buttons', async () => {
    await act(async () => {
      render(<WorkspacePicker />)
    })
    expect(screen.getByText('New Workspace')).toBeDefined()
    expect(screen.getByText('Open Single Project')).toBeDefined()
  })

  it('renders workspace list when workspaces exist', async () => {
    await act(async () => {
      renderWithWorkspaces()
    })

    expect(screen.getByText('Alpha Project')).toBeDefined()
    expect(screen.getByText('Beta Suite')).toBeDefined()
    expect(screen.getByText('Gamma')).toBeDefined()
  })

  it('shows workspace project folders and count', async () => {
    await act(async () => {
      renderWithWorkspaces()
    })

    // Alpha has 2 projects
    expect(screen.getByText('2 projects')).toBeDefined()
    // Beta has 1 project
    expect(screen.getByText('1 project')).toBeDefined()
    // Gamma has 3 projects
    expect(screen.getByText('3 projects')).toBeDefined()
  })

  it('sorts workspaces by lastOpenedAt descending (most recent first)', async () => {
    await act(async () => {
      renderWithWorkspaces()
    })

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    // Alpha (most recent) should be first
    expect(options[0].textContent).toContain('Alpha Project')
    expect(options[1].textContent).toContain('Beta Suite')
    expect(options[2].textContent).toContain('Gamma')
  })

  it('highlights the most recent workspace', async () => {
    await act(async () => {
      renderWithWorkspaces()
    })

    const options = screen.getAllByRole('option')
    // First item should have the most-recent class
    expect(options[0].className).toContain('itemMostRecent')
    expect(options[1].className).not.toContain('itemMostRecent')
  })

  it('keyboard navigation: ArrowDown moves selection down', async () => {
    await act(async () => {
      renderWithWorkspaces()
    })

    const options = screen.getAllByRole('option')
    // Initially first item is selected
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(options[1].getAttribute('aria-selected')).toBe('false')

    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowDown' })
    })

    expect(options[0].getAttribute('aria-selected')).toBe('false')
    expect(options[1].getAttribute('aria-selected')).toBe('true')
  })

  it('keyboard navigation: ArrowUp moves selection up', async () => {
    await act(async () => {
      renderWithWorkspaces()
    })

    // Move down first, then up
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowDown' })
    })
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowUp' })
    })

    const options = screen.getAllByRole('option')
    expect(options[0].getAttribute('aria-selected')).toBe('true')
  })

  it('keyboard navigation: ArrowUp does not go below 0', async () => {
    await act(async () => {
      renderWithWorkspaces()
    })

    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowUp' })
    })

    const options = screen.getAllByRole('option')
    expect(options[0].getAttribute('aria-selected')).toBe('true')
  })

  it('keyboard navigation: ArrowDown does not exceed list length', async () => {
    await act(async () => {
      renderWithWorkspaces()
    })

    // Press down many times
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        fireEvent.keyDown(window, { key: 'ArrowDown' })
      })
    }

    const options = screen.getAllByRole('option')
    // Should be clamped to last item
    expect(options[2].getAttribute('aria-selected')).toBe('true')
  })

  it('clicking a workspace calls openWorkspace', async () => {
    mockApi.workspaceList.mockResolvedValue(mockWorkspaces)

    await act(async () => {
      renderWithWorkspaces()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Beta Suite'))
    })

    expect(mockApi.workspaceOpen).toHaveBeenCalledWith('ws_2')
  })

  it('Enter key opens the selected workspace', async () => {
    mockApi.workspaceList.mockResolvedValue(mockWorkspaces)

    await act(async () => {
      renderWithWorkspaces()
    })

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })

    // First workspace (Alpha) should be opened
    expect(mockApi.workspaceOpen).toHaveBeenCalledWith('ws_1')
  })

  it('"Open Single Project" opens directory picker', async () => {
    mockApi.openDirectory.mockResolvedValue(null)

    await act(async () => {
      render(<WorkspacePicker />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Open Single Project'))
    })

    expect(mockApi.openDirectory).toHaveBeenCalled()
  })

  it('"Open Single Project" calls openSingleProject when directory selected', async () => {
    mockApi.openDirectory.mockResolvedValue('/Users/dev/my-project')
    mockApi.workspaceOpenSingle.mockResolvedValue(undefined)

    await act(async () => {
      render(<WorkspacePicker />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Open Single Project'))
    })

    expect(mockApi.workspaceOpenSingle).toHaveBeenCalledWith('/Users/dev/my-project')
  })

  it('"New Workspace" button shows the create form', async () => {
    await act(async () => {
      render(<WorkspacePicker />)
    })

    expect(screen.queryByTestId('new-workspace-form')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByText('New Workspace'))
    })

    expect(screen.getByTestId('new-workspace-form')).toBeDefined()
    expect(screen.getByPlaceholderText('Workspace name')).toBeDefined()
  })

  it('Meta+N shortcut opens new workspace form', async () => {
    await act(async () => {
      render(<WorkspacePicker />)
    })

    await act(async () => {
      fireEvent.keyDown(window, { key: 'n', metaKey: true })
    })

    expect(screen.getByTestId('new-workspace-form')).toBeDefined()
  })

  it('shows empty state when no workspaces', async () => {
    await act(async () => {
      render(<WorkspacePicker />)
    })

    expect(screen.getByText(/No workspaces yet/)).toBeDefined()
  })

  it('displays colored avatar with first letter of workspace name', async () => {
    await act(async () => {
      renderWithWorkspaces([mockWorkspaces[0]])
    })

    // Avatar should show "A" for "Alpha Project"
    const options = screen.getAllByRole('option')
    expect(options[0].textContent).toContain('A')
  })

  it('mouseEnter on a workspace item changes selection', async () => {
    await act(async () => {
      renderWithWorkspaces()
    })

    const options = screen.getAllByRole('option')
    expect(options[0].getAttribute('aria-selected')).toBe('true')

    await act(async () => {
      fireEvent.mouseEnter(options[2])
    })

    expect(options[2].getAttribute('aria-selected')).toBe('true')
    expect(options[0].getAttribute('aria-selected')).toBe('false')
  })

  it('cancel button hides the new workspace form', async () => {
    await act(async () => {
      render(<WorkspacePicker />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('New Workspace'))
    })

    expect(screen.getByTestId('new-workspace-form')).toBeDefined()

    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'))
    })

    expect(screen.queryByTestId('new-workspace-form')).toBeNull()
  })

  it('new workspace form: "Add folders" opens directory picker', async () => {
    mockApi.openDirectory.mockResolvedValue('/Users/dev/new-project')

    await act(async () => {
      render(<WorkspacePicker />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('New Workspace'))
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Add folders'))
    })

    expect(mockApi.openDirectory).toHaveBeenCalled()
  })

  it('new workspace form: shows Create button after adding folder', async () => {
    mockApi.openDirectory.mockResolvedValue('/Users/dev/new-project')

    await act(async () => {
      render(<WorkspacePicker />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('New Workspace'))
    })

    // No Create button yet
    expect(screen.queryByText('Create')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByText('Add folders'))
    })

    // Now Create button should appear
    expect(screen.getByText('Create')).toBeDefined()
  })

  it('new workspace form: Create calls workspaceCreate', async () => {
    mockApi.openDirectory.mockResolvedValue('/Users/dev/new-project')
    mockApi.workspaceCreate.mockResolvedValue({
      id: 'ws_new',
      name: 'My Workspace',
      projectPaths: ['/Users/dev/new-project'],
      lastOpenedAt: '2026-03-13T12:00:00Z',
      createdAt: '2026-03-13T12:00:00Z'
    })
    mockApi.workspaceOpen.mockResolvedValue(undefined)
    mockApi.workspaceList.mockResolvedValue([])

    await act(async () => {
      render(<WorkspacePicker />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('New Workspace'))
    })

    // Type workspace name
    const nameInput = screen.getByPlaceholderText('Workspace name')
    fireEvent.change(nameInput, { target: { value: 'My Workspace' } })

    // Add a folder
    await act(async () => {
      fireEvent.click(screen.getByText('Add folders'))
    })

    // Click Create
    await act(async () => {
      fireEvent.click(screen.getByText('Create'))
    })

    expect(mockApi.workspaceCreate).toHaveBeenCalledWith('My Workspace', ['/Users/dev/new-project'])
  })
})
