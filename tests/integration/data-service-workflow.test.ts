import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { DataService } from '../../src/main/services/data-service'
import type { Task, ActivityEntry } from '../../src/shared/types'

describe('DataService workflow integration test', () => {
  let tmpDir: string
  let service: DataService

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ds-workflow-'))
    service = new DataService(tmpDir)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  function makeTask(id: string, title: string, overrides: Partial<Task> = {}): Task {
    return {
      id,
      title,
      status: 'backlog',
      priority: 'none',
      labels: [],
      agentStatus: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortOrder: 0,
      ...overrides
    }
  }

  it('full workflow: init -> create tasks -> modify -> read back -> delete -> verify', async () => {
    // 1. Init project
    const initState = await service.initProject('Integration Test')
    expect(initState.projectName).toBe('Integration Test')
    expect(await service.isInitialized()).toBe(true)

    // 2. Create multiple tasks
    const task1 = makeTask('tsk_wf_001', 'Build API', { priority: 'high', sortOrder: 0 })
    const task2 = makeTask('tsk_wf_002', 'Design UI', { priority: 'medium', sortOrder: 1 })
    const task3 = makeTask('tsk_wf_003', 'Write docs', { priority: 'low', sortOrder: 2 })

    await service.createTask(task1)
    await service.createTask(task2)
    await service.createTask(task3)

    // Update project state with tasks
    let state = await service.readProjectState()
    state.tasks = [task1, task2, task3]
    await service.writeProjectState(state)

    // 3. Modify tasks
    const updatedTask1 = { ...task1, status: 'in-progress' as const, updatedAt: new Date().toISOString() }
    await service.updateTask(updatedTask1)

    const updatedTask2 = { ...task2, title: 'Redesign UI', priority: 'high' as const, updatedAt: new Date().toISOString() }
    await service.updateTask(updatedTask2)

    // Write documents
    await service.writeTaskDocument('tsk_wf_001', '# API Design\n\nREST endpoints...')
    await service.writeTaskDocument('tsk_wf_002', '# UI Mockups\n\nFigma links...')

    // 4. Read back state and verify
    const readTask1 = await service.readTask('tsk_wf_001')
    expect(readTask1.status).toBe('in-progress')

    const readTask2 = await service.readTask('tsk_wf_002')
    expect(readTask2.title).toBe('Redesign UI')
    expect(readTask2.priority).toBe('high')

    const doc1 = await service.readTaskDocument('tsk_wf_001')
    expect(doc1).toContain('REST endpoints')

    const doc2 = await service.readTaskDocument('tsk_wf_002')
    expect(doc2).toContain('Figma links')

    // 5. Verify activity logs
    const entry1: ActivityEntry = {
      id: 'act_wf_001',
      timestamp: new Date().toISOString(),
      type: 'created',
      message: 'Task created: Build API'
    }
    const entry2: ActivityEntry = {
      id: 'act_wf_002',
      timestamp: new Date().toISOString(),
      type: 'status_change',
      message: 'Status changed to in-progress'
    }
    const entry3: ActivityEntry = {
      id: 'act_wf_003',
      timestamp: new Date().toISOString(),
      type: 'note',
      message: 'Started implementation'
    }

    await service.appendActivity('tsk_wf_001', entry1)
    await service.appendActivity('tsk_wf_001', entry2)
    await service.appendActivity('tsk_wf_001', entry3)

    const activities = await service.readTaskActivity('tsk_wf_001')
    expect(activities).toHaveLength(3)
    expect(activities[0].type).toBe('created')
    expect(activities[1].type).toBe('status_change')
    expect(activities[2].type).toBe('note')

    // 6. Delete tasks
    await service.deleteTask('tsk_wf_003')
    state = await service.readProjectState()
    state.tasks = state.tasks.filter((t) => t.id !== 'tsk_wf_003')
    await service.writeProjectState(state)

    // 7. Verify cleanup
    state = await service.readProjectState()
    expect(state.tasks).toHaveLength(2)
    expect(state.tasks.find((t) => t.id === 'tsk_wf_003')).toBeUndefined()

    // Verify task directory is gone
    const task3Dir = path.join(tmpDir, '.familiar', 'tasks', 'tsk_wf_003')
    await expect(fs.access(task3Dir)).rejects.toThrow()

    // Verify remaining tasks still exist
    const remaining1 = await service.readTask('tsk_wf_001')
    expect(remaining1.title).toBe('Build API')

    const remaining2 = await service.readTask('tsk_wf_002')
    expect(remaining2.title).toBe('Redesign UI')
  })
})
