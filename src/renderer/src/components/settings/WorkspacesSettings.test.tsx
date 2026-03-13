import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { WorkspacesSettings } from './WorkspacesSettings'
import type { Workspace } from '@shared/types'

// Mock window.api with workspace methods
const mockApi = {
  workspaceList: vi.fn().mockResolvedValue([]),
  workspaceCreate: vi.fn(),
  workspaceUpdate: vi.fn(),
  workspaceDelete: vi.fn()
}

;(window as any).api = mockApi

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws_test01',
    name: 'My Workspace',
    projectPaths: ['/Users/test/project-a', '/Users/test/project-b'],
    lastOpenedAt: '2026-03-10T00:00:00.000Z',
    createdAt: '2026-03-01T00:00:00.000Z',
    ...overrides
  }
}

describe('WorkspacesSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.workspaceList.mockResolvedValue([])
    // Reset the workspace store
    useWorkspaceStore.setState({
      workspaces: [],
      activeWorkspace: null,
      openProjects: [],
      activeProjectPath: null
    })
  })

  it('renders "Workspaces" section heading', async () => {
    await act(async () => {
      render(<WorkspacesSettings />)
    })
    expect(screen.getByText('Workspaces')).toBeInTheDocument()
  })

  it('shows empty state when no workspaces exist', async () => {
    await act(async () => {
      render(<WorkspacesSettings />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('workspaces-empty')).toBeInTheDocument()
      expect(screen.getByText('No saved workspaces')).toBeInTheDocument()
    })
  })

  it('shows workspace list when workspaces exist', async () => {
    const ws1 = makeWorkspace({ id: 'ws_1', name: 'Frontend' })
    const ws2 = makeWorkspace({ id: 'ws_2', name: 'Backend', projectPaths: ['/srv/api'] })
    mockApi.workspaceList.mockResolvedValue([ws1, ws2])

    await act(async () => {
      render(<WorkspacesSettings />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('workspaces-list')).toBeInTheDocument()
    })
    expect(screen.getByText('Frontend')).toBeInTheDocument()
    expect(screen.getByText('Backend')).toBeInTheDocument()
    // Project count
    expect(screen.getByText(/2 projects/)).toBeInTheDocument()
    expect(screen.getByText(/1 project\b/)).toBeInTheDocument()
  })

  it('shows project paths in workspace rows', async () => {
    const ws = makeWorkspace({ projectPaths: ['/a/b', '/c/d'] })
    mockApi.workspaceList.mockResolvedValue([ws])

    await act(async () => {
      render(<WorkspacesSettings />)
    })

    await waitFor(() => {
      expect(screen.getByText('/a/b, /c/d')).toBeInTheDocument()
    })
  })

  it('delete button calls deleteWorkspace after confirmation', async () => {
    const ws = makeWorkspace()
    mockApi.workspaceList.mockResolvedValueOnce([ws]).mockResolvedValue([])
    mockApi.workspaceDelete.mockResolvedValue(undefined)

    ;(window as any).confirm = vi.fn().mockReturnValue(true)

    await act(async () => {
      render(<WorkspacesSettings />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('workspace-delete-btn')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('workspace-delete-btn'))
    })

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Delete workspace')
    )
    expect(mockApi.workspaceDelete).toHaveBeenCalledWith(ws.id)
  })

  it('delete button does not call deleteWorkspace when confirmation is cancelled', async () => {
    const ws = makeWorkspace()
    mockApi.workspaceList.mockResolvedValue([ws])

    ;(window as any).confirm = vi.fn().mockReturnValue(false)

    await act(async () => {
      render(<WorkspacesSettings />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('workspace-delete-btn')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('workspace-delete-btn'))
    })

    expect(window.confirm).toHaveBeenCalled()
    expect(mockApi.workspaceDelete).not.toHaveBeenCalled()
  })

  it('edit button enables inline name editing', async () => {
    const ws = makeWorkspace({ name: 'Original Name' })
    mockApi.workspaceList.mockResolvedValue([ws])

    await act(async () => {
      render(<WorkspacesSettings />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('workspace-edit-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('workspace-edit-btn'))

    const input = screen.getByTestId('workspace-name-input') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.value).toBe('Original Name')
  })

  it('shows Create Workspace button', async () => {
    await act(async () => {
      render(<WorkspacesSettings />)
    })

    expect(screen.getByTestId('workspace-create-btn')).toBeInTheDocument()
    expect(screen.getByText('+ Create Workspace')).toBeInTheDocument()
  })

  it('clicking Create Workspace shows inline form', async () => {
    await act(async () => {
      render(<WorkspacesSettings />)
    })

    fireEvent.click(screen.getByTestId('workspace-create-btn'))

    expect(screen.getByTestId('workspace-create-form')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Workspace name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Project paths (one per line)')).toBeInTheDocument()
  })

  it('calls loadWorkspaces on mount', async () => {
    await act(async () => {
      render(<WorkspacesSettings />)
    })

    expect(mockApi.workspaceList).toHaveBeenCalled()
  })
})
