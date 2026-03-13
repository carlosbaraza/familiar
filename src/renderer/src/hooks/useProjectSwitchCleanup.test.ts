import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useTerminalStore } from '@renderer/stores/terminal-store'
import { useProjectSwitchCleanup } from './useProjectSwitchCleanup'
import type { TerminalPane, ProjectState } from '@shared/types'

describe('useProjectSwitchCleanup', () => {
  beforeEach(() => {
    // Reset all stores
    useWorkspaceStore.setState({ activeProjectPath: null })
    useTaskStore.setState({ projectState: null })
    useTerminalStore.setState({
      sessions: new Map(),
      panesByTask: new Map(),
      activePaneByTask: new Map()
    })
  })

  it('does not clear sessions on initial mount', () => {
    // Set up terminal state for a task
    const pane: TerminalPane = { id: 'pane-1', sessionName: 's1', title: 'T1' }
    useTerminalStore.getState().addPane('tsk_old', pane)

    // Mount the hook with no project path
    renderHook(() => useProjectSwitchCleanup())

    // Sessions should still be there (no project switch happened)
    expect(useTerminalStore.getState().panesByTask.has('tsk_old')).toBe(true)
  })

  it('clears non-active task sessions when project path changes', () => {
    // Set up terminal state for tasks from two different projects
    const paneA: TerminalPane = { id: 'pane-a', sessionName: 'sa', title: 'TA' }
    const paneB: TerminalPane = { id: 'pane-b', sessionName: 'sb', title: 'TB' }
    useTerminalStore.getState().addPane('tsk_projA', paneA)
    useTerminalStore.getState().addPane('tsk_projB', paneB)

    // Start with project A
    useWorkspaceStore.setState({ activeProjectPath: '/projects/a' })
    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'Project A',
        tasks: [
          {
            id: 'tsk_projA',
            title: 'Task A',
            status: 'todo',
            priority: 'none',
            labels: [],
            agentStatus: 'idle',
            createdAt: '',
            updatedAt: '',
            sortOrder: 0
          }
        ],
        labels: [],
        columnOrder: []
      } as ProjectState
    })

    const { rerender } = renderHook(() => useProjectSwitchCleanup())

    // Now switch to project B — update task store first, then project path
    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'Project B',
        tasks: [
          {
            id: 'tsk_projB',
            title: 'Task B',
            status: 'todo',
            priority: 'none',
            labels: [],
            agentStatus: 'idle',
            createdAt: '',
            updatedAt: '',
            sortOrder: 0
          }
        ],
        labels: [],
        columnOrder: []
      } as ProjectState
    })
    useWorkspaceStore.setState({ activeProjectPath: '/projects/b' })
    rerender()

    // tsk_projA should be cleaned up, tsk_projB should remain
    const state = useTerminalStore.getState()
    expect(state.panesByTask.has('tsk_projA')).toBe(false)
    expect(state.panesByTask.has('tsk_projB')).toBe(true)
  })

  it('clears all sessions when switching to a project with no tasks', () => {
    const pane: TerminalPane = { id: 'pane-1', sessionName: 's1', title: 'T1' }
    useTerminalStore.getState().addPane('tsk_old', pane)

    useWorkspaceStore.setState({ activeProjectPath: '/projects/a' })
    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'Project A',
        tasks: [
          {
            id: 'tsk_old',
            title: 'Old',
            status: 'todo',
            priority: 'none',
            labels: [],
            agentStatus: 'idle',
            createdAt: '',
            updatedAt: '',
            sortOrder: 0
          }
        ],
        labels: [],
        columnOrder: []
      } as ProjectState
    })

    const { rerender } = renderHook(() => useProjectSwitchCleanup())

    // Switch to empty project
    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'Empty',
        tasks: [],
        labels: [],
        columnOrder: []
      } as ProjectState
    })
    useWorkspaceStore.setState({ activeProjectPath: '/projects/empty' })
    rerender()

    expect(useTerminalStore.getState().panesByTask.size).toBe(0)
  })
})
