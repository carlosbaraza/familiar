import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock node-pty before importing the module
vi.mock('node-pty', () => ({
  spawn: vi.fn()
}))

// Mock child_process
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process')
  return {
    ...actual,
    default: actual,
    execFileSync: vi.fn(() => '/usr/local/bin/tmux')
  }
})

// Mock fs for resolveExecutable
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => true)
  }
})

// Mock claude-session
vi.mock('../services/claude-session', () => ({
  resolveClaudeSessionCommand: vi.fn((cmd: string) => cmd)
}))

import { ElectronPtyManager } from './electron-pty'
import type { DataService } from '../services/data-service'
import type { Task, ProjectState } from '../../shared/types'

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test task',
    status: 'in-progress',
    priority: 'medium',
    labels: [],
    agentStatus: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sortOrder: 0,
    ...overrides
  }
}

function createMockDataService(tasks: Task[]): DataService {
  const state: ProjectState = {
    tasks,
    version: 1,
    projectName: 'test',
    columnOrder: ['todo', 'in-progress', 'in-review', 'done'],
    labels: []
  }

  return {
    readProjectState: vi.fn().mockResolvedValue(state),
    writeProjectState: vi.fn().mockResolvedValue(undefined),
    readTask: vi.fn().mockImplementation((id: string) => {
      const task = tasks.find((t) => t.id === id)
      if (!task) return Promise.reject(new Error('Not found'))
      return Promise.resolve({ ...task })
    }),
    updateTask: vi.fn().mockResolvedValue(undefined),
    readSettings: vi.fn().mockResolvedValue({})
  } as unknown as DataService
}

function createMockTmux(): ConstructorParameters<typeof ElectronPtyManager>[0] {
  return {
    hasSession: vi.fn().mockResolvedValue(false),
    createSession: vi.fn().mockResolvedValue(undefined),
    sendKeys: vi.fn().mockResolvedValue(undefined)
  } as unknown as ConstructorParameters<typeof ElectronPtyManager>[0]
}

describe('ElectronPtyManager inactivity detection', () => {
  let manager: ElectronPtyManager
  let mockTmux: ReturnType<typeof createMockTmux>

  beforeEach(() => {
    vi.useFakeTimers()
    mockTmux = createMockTmux()
    manager = new ElectronPtyManager(mockTmux)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should reset running tasks with no active PTY sessions to idle', async () => {
    const task = createMockTask({ id: 'task-1', agentStatus: 'running' })
    const ds = createMockDataService([task])
    manager.setDataService(ds)

    // No PTY sessions exist for task-1 (no create() called)
    // Trigger inactivity check by advancing time past the check interval
    vi.advanceTimersByTime(15_000)

    // Allow promises to resolve
    await vi.waitFor(() => {
      expect(ds.readProjectState).toHaveBeenCalled()
    })

    // The task in the project state should have been set to idle
    const writeCall = (ds.writeProjectState as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(writeCall).toBeDefined()
    const updatedState = writeCall[0] as ProjectState
    expect(updatedState.tasks[0].agentStatus).toBe('idle')
  })

  it('should not reset tasks that are not running', async () => {
    const task = createMockTask({ id: 'task-1', agentStatus: 'idle' })
    const ds = createMockDataService([task])
    manager.setDataService(ds)

    vi.advanceTimersByTime(15_000)

    await vi.waitFor(() => {
      expect(ds.readProjectState).toHaveBeenCalled()
    })

    // writeProjectState should NOT have been called since nothing changed
    expect(ds.writeProjectState).not.toHaveBeenCalled()
  })

  it('should not reset archived tasks', async () => {
    const task = createMockTask({
      id: 'task-1',
      agentStatus: 'running',
      status: 'archived'
    })
    const ds = createMockDataService([task])
    manager.setDataService(ds)

    vi.advanceTimersByTime(15_000)

    await vi.waitFor(() => {
      expect(ds.readProjectState).toHaveBeenCalled()
    })

    expect(ds.writeProjectState).not.toHaveBeenCalled()
  })

  it('should handle multiple running tasks correctly', async () => {
    const task1 = createMockTask({ id: 'task-1', agentStatus: 'running' })
    const task2 = createMockTask({ id: 'task-2', agentStatus: 'running' })
    const task3 = createMockTask({ id: 'task-3', agentStatus: 'done' })
    const ds = createMockDataService([task1, task2, task3])
    manager.setDataService(ds)

    vi.advanceTimersByTime(15_000)

    await vi.waitFor(() => {
      expect(ds.writeProjectState).toHaveBeenCalled()
    })

    const updatedState = (ds.writeProjectState as ReturnType<typeof vi.fn>).mock.calls[0][0] as ProjectState
    // Both running tasks should be reset (no active PTY sessions)
    expect(updatedState.tasks[0].agentStatus).toBe('idle')
    expect(updatedState.tasks[1].agentStatus).toBe('idle')
    // Done task should remain done
    expect(updatedState.tasks[2].agentStatus).toBe('done')
  })

  it('should do nothing when dataService is not set', () => {
    // Don't set dataService
    vi.advanceTimersByTime(15_000)
    // No errors should be thrown
  })

  it('should track activity time when _handleActivityDetection is called', () => {
    const ds = createMockDataService([createMockTask({ agentStatus: 'idle' })])
    manager.setDataService(ds)

    // Access private method via bracket notation for testing
    const mgr = manager as unknown as {
      _handleActivityDetection: (taskId: string) => void
      _lastActivityTime: Map<string, number>
    }

    mgr._handleActivityDetection('task-1')
    expect(mgr._lastActivityTime.has('task-1')).toBe(true)
  })
})
