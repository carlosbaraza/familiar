import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { DataService } from './data-service'
import type { Task, ActivityEntry } from '../../shared/types'

describe('DataService', () => {
  let tmpDir: string
  let service: DataService

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'data-service-test-'))
    service = new DataService(tmpDir)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  function makeTask(overrides: Partial<Task> = {}): Task {
    return {
      id: 'tsk_ds_test',
      title: 'Test task',
      status: 'todo',
      priority: 'none',
      labels: [],
      agentStatus: 'idle',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sortOrder: 0,
      ...overrides
    }
  }

  describe('initProject', () => {
    it('creates directory structure and state file', async () => {
      const state = await service.initProject('My Project')

      expect(state.projectName).toBe('My Project')
      expect(state.version).toBe(1)
      expect(state.tasks).toEqual([])
      expect(state.columnOrder).toHaveLength(5)

      // Verify directories exist
      const dataDir = path.join(tmpDir, '.familiar')
      const tasksDir = path.join(dataDir, 'tasks')
      await expect(fs.access(dataDir)).resolves.toBeUndefined()
      await expect(fs.access(tasksDir)).resolves.toBeUndefined()

      // Verify state file exists
      const stateFile = path.join(dataDir, 'state.json')
      await expect(fs.access(stateFile)).resolves.toBeUndefined()
    })
  })

  describe('readProjectState / writeProjectState round-trip', () => {
    it('writes and reads back project state', async () => {
      await service.initProject('Test')

      const state = await service.readProjectState()
      state.projectName = 'Updated Name'
      state.labels = [{ name: 'bug', color: '#ef4444' }, { name: 'feature', color: '#3b82f6' }]
      await service.writeProjectState(state)

      const readBack = await service.readProjectState()
      expect(readBack.projectName).toBe('Updated Name')
      expect(readBack.labels).toEqual([{ name: 'bug', color: '#ef4444' }, { name: 'feature', color: '#3b82f6' }])
    })
  })

  describe('label sanitization on read', () => {
    it('migrates plain string labels to LabelConfig objects', async () => {
      await service.initProject('Test')
      // Write raw state with string labels
      const stateFile = path.join(tmpDir, '.familiar', 'state.json')
      const state = JSON.parse(await fs.readFile(stateFile, 'utf-8'))
      state.labels = ['bug', 'feature']
      await fs.writeFile(stateFile, JSON.stringify(state))

      const result = await service.readProjectState()
      expect(result.labels).toEqual([
        { name: 'bug', color: expect.any(String) },
        { name: 'feature', color: expect.any(String) }
      ])
    })

    it('fixes corrupted labels where name is an object', async () => {
      await service.initProject('Test')
      const stateFile = path.join(tmpDir, '.familiar', 'state.json')
      const state = JSON.parse(await fs.readFile(stateFile, 'utf-8'))
      state.labels = [
        { name: 'bug', color: '#ef4444' },
        { name: { name: 'feature', color: '#6b7280' }, color: '#6b7280' }
      ]
      await fs.writeFile(stateFile, JSON.stringify(state))

      const result = await service.readProjectState()
      expect(result.labels).toEqual([
        { name: 'bug', color: '#ef4444' },
        { name: 'feature', color: '#6b7280' }
      ])
    })

    it('deduplicates labels by name', async () => {
      await service.initProject('Test')
      const stateFile = path.join(tmpDir, '.familiar', 'state.json')
      const state = JSON.parse(await fs.readFile(stateFile, 'utf-8'))
      state.labels = [
        { name: 'bug', color: '#ef4444' },
        { name: 'bug', color: '#3b82f6' }
      ]
      await fs.writeFile(stateFile, JSON.stringify(state))

      const result = await service.readProjectState()
      expect(result.labels).toHaveLength(1)
      expect(result.labels[0]).toEqual({ name: 'bug', color: '#ef4444' })
    })

    it('handles mixed string and object labels', async () => {
      await service.initProject('Test')
      const stateFile = path.join(tmpDir, '.familiar', 'state.json')
      const state = JSON.parse(await fs.readFile(stateFile, 'utf-8'))
      state.labels = ['bug', { name: 'feature', color: '#3b82f6' }]
      await fs.writeFile(stateFile, JSON.stringify(state))

      const result = await service.readProjectState()
      expect(result.labels).toHaveLength(2)
      expect(result.labels[0].name).toBe('bug')
      expect(result.labels[1]).toEqual({ name: 'feature', color: '#3b82f6' })
    })
  })

  describe('label sanitization on write', () => {
    it('strips labels with non-string names on write', async () => {
      await service.initProject('Test')
      const state = await service.readProjectState()
      state.labels = [
        { name: 'valid', color: '#ef4444' },
        { name: { nested: true } as any, color: '#3b82f6' }
      ]
      await service.writeProjectState(state)

      const stateFile = path.join(tmpDir, '.familiar', 'state.json')
      const written = JSON.parse(await fs.readFile(stateFile, 'utf-8'))
      expect(written.labels).toEqual([{ name: 'valid', color: '#ef4444' }])
    })

    it('deduplicates labels on write', async () => {
      await service.initProject('Test')
      const state = await service.readProjectState()
      state.labels = [
        { name: 'bug', color: '#ef4444' },
        { name: 'bug', color: '#3b82f6' }
      ]
      await service.writeProjectState(state)

      const stateFile = path.join(tmpDir, '.familiar', 'state.json')
      const written = JSON.parse(await fs.readFile(stateFile, 'utf-8'))
      expect(written.labels).toHaveLength(1)
    })
  })

  describe('isInitialized', () => {
    it('returns false before init', async () => {
      expect(await service.isInitialized()).toBe(false)
    })

    it('returns true after init', async () => {
      await service.initProject('Test')
      expect(await service.isInitialized()).toBe(true)
    })
  })

  describe('createTask', () => {
    it('creates task directory with task.json, document.md, and activity.json', async () => {
      await service.initProject('Test')
      const task = makeTask()
      await service.createTask(task)

      const taskDir = path.join(tmpDir, '.familiar', 'tasks', task.id)
      await expect(fs.access(taskDir)).resolves.toBeUndefined()
      await expect(fs.access(path.join(taskDir, 'task.json'))).resolves.toBeUndefined()
      await expect(fs.access(path.join(taskDir, 'document.md'))).resolves.toBeUndefined()
      await expect(fs.access(path.join(taskDir, 'activity.json'))).resolves.toBeUndefined()
    })
  })

  describe('readTask', () => {
    it('reads back the created task', async () => {
      await service.initProject('Test')
      const task = makeTask({ title: 'Read me back' })
      await service.createTask(task)

      const readBack = await service.readTask(task.id)
      expect(readBack.title).toBe('Read me back')
      expect(readBack.id).toBe(task.id)
    })
  })

  describe('updateTask', () => {
    it('modifies task.json', async () => {
      await service.initProject('Test')
      const task = makeTask()
      await service.createTask(task)

      const updated = { ...task, title: 'Updated title', priority: 'high' as const }
      await service.updateTask(updated)

      const readBack = await service.readTask(task.id)
      expect(readBack.title).toBe('Updated title')
      expect(readBack.priority).toBe('high')
    })
  })

  describe('deleteTask', () => {
    it('removes the task directory', async () => {
      await service.initProject('Test')
      const task = makeTask()
      await service.createTask(task)

      await service.deleteTask(task.id)

      const taskDir = path.join(tmpDir, '.familiar', 'tasks', task.id)
      await expect(fs.access(taskDir)).rejects.toThrow()
    })
  })

  describe('readTaskDocument / writeTaskDocument', () => {
    it('round-trips document content', async () => {
      await service.initProject('Test')
      const task = makeTask()
      await service.createTask(task)

      await service.writeTaskDocument(task.id, '# Hello\n\nSome content')
      const doc = await service.readTaskDocument(task.id)
      expect(doc).toBe('# Hello\n\nSome content')
    })
  })

  describe('appendActivity', () => {
    it('adds entries to the activity log', async () => {
      await service.initProject('Test')
      const task = makeTask()
      await service.createTask(task)

      const entry1: ActivityEntry = {
        id: 'act_001',
        timestamp: '2026-01-01T00:00:00.000Z',
        type: 'created',
        message: 'Task created'
      }
      const entry2: ActivityEntry = {
        id: 'act_002',
        timestamp: '2026-01-01T01:00:00.000Z',
        type: 'note',
        message: 'A note'
      }

      await service.appendActivity(task.id, entry1)
      await service.appendActivity(task.id, entry2)

      const activities = await service.readTaskActivity(task.id)
      expect(activities).toHaveLength(2)
      expect(activities[0].message).toBe('Task created')
      expect(activities[1].message).toBe('A note')
    })
  })

  describe('listTaskFiles', () => {
    it('lists files recursively, excluding metadata and hidden files', async () => {
      await service.initProject('Test')
      const task = makeTask()
      await service.createTask(task)

      // Write a document and an attachment
      await service.writeTaskDocument(task.id, '# Hello')
      await service.saveAttachment(task.id, 'image.png', new ArrayBuffer(16))

      const files = await service.listTaskFiles(task.id)
      const names = files.map((f) => f.name)

      // Should include document.md and flattened attachment path
      expect(names).toContain('document.md')
      expect(names).toContain('attachments/image.png')
      // Should NOT include metadata files
      expect(names).not.toContain('task.json')
      expect(names).not.toContain('activity.json')
    })

    it('flattens attachments directory into prefixed names', async () => {
      await service.initProject('Test')
      const task = makeTask()
      await service.createTask(task)

      await service.saveAttachment(task.id, 'img.png', new ArrayBuffer(8))

      const files = await service.listTaskFiles(task.id)
      const attachment = files.find((f) => f.name === 'attachments/img.png')
      expect(attachment).toBeDefined()
      expect(attachment!.isDir).toBe(false)
      expect(attachment!.size).toBe(8)
    })

    it('returns empty array for nonexistent task', async () => {
      await service.initProject('Test')
      const files = await service.listTaskFiles('nonexistent')
      expect(files).toEqual([])
    })
  })

  describe('getProjectRoot auto-heal', () => {
    it('returns stored root when it still exists', () => {
      expect(service.getProjectRoot()).toBe(tmpDir)
    })

    it('auto-heals via process.cwd() when stored root is stale', async () => {
      await service.initProject('Test')

      // Simulate: stored root no longer exists, but cwd points to a dir with .familiar/
      const staleRoot = path.join(os.tmpdir(), 'stale-root-' + Date.now())
      const staleService = new DataService(staleRoot)
      // Mock process.cwd to return the tmpDir (which has .familiar/)
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

      const root = staleService.getProjectRoot()
      expect(root).toBe(tmpDir)

      cwdSpy.mockRestore()
    })

    it('auto-heals via sibling scan when cwd has no .familiar/', async () => {
      // Create an isolated parent directory so the sibling scan only finds our project
      const isolatedParent = await fs.mkdtemp(path.join(os.tmpdir(), 'heal-test-parent-'))
      const originalDir = path.join(isolatedParent, 'original-project')
      await fs.mkdir(originalDir)

      const isolatedService = new DataService(originalDir)
      await isolatedService.initProject('Test')

      // Simulate rename: move .familiar/ to a sibling
      const renamedDir = path.join(isolatedParent, 'renamed-project')
      await fs.rename(originalDir, renamedDir)

      // Mock process.cwd to return a dir without .familiar/
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(os.tmpdir())

      const root = isolatedService.getProjectRoot()
      expect(root).toBe(renamedDir)

      cwdSpy.mockRestore()
      await fs.rm(isolatedParent, { recursive: true, force: true })
    })

    it('returns stale root when no .familiar/ found nearby', () => {
      // Use a path whose parent has no .familiar/ children
      const fakeRoot = path.join(os.tmpdir(), 'nonexistent-parent-' + Date.now(), 'project')
      const fakeService = new DataService(fakeRoot)
      // Mock cwd to avoid accidentally finding a real .familiar/
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(os.tmpdir())

      expect(fakeService.getProjectRoot()).toBe(fakeRoot)

      cwdSpy.mockRestore()
    })
  })

  describe('attachment path migration', () => {
    it('migrates absolute attachment paths to filenames in readTask', async () => {
      await service.initProject('Test')
      const task = makeTask({
        attachments: ['/old/path/.familiar/tasks/tsk_ds_test/attachments/image.png']
      })
      await service.createTask(task)

      // Write task with absolute path directly to bypass migration
      const taskFile = path.join(tmpDir, '.familiar', 'tasks', task.id, 'task.json')
      const raw = JSON.parse(await fs.readFile(taskFile, 'utf-8'))
      raw.attachments = ['/old/path/.familiar/tasks/tsk_ds_test/attachments/image.png']
      await fs.writeFile(taskFile, JSON.stringify(raw))

      const readBack = await service.readTask(task.id)
      expect(readBack.attachments).toEqual(['image.png'])
    })

    it('migrates absolute attachment paths in state.json', async () => {
      await service.initProject('Test')
      const state = await service.readProjectState()
      state.tasks.push(makeTask({
        attachments: ['/old/path/image.png', 'already-relative.png']
      }))
      await service.writeProjectState(state)

      const readBack = await service.readProjectState()
      expect(readBack.tasks[0].attachments).toEqual(['image.png', 'already-relative.png'])
    })

    it('saveAttachment returns filename not absolute path', async () => {
      await service.initProject('Test')
      const task = makeTask()
      await service.createTask(task)

      const result = await service.saveAttachment(task.id, 'test.png', new ArrayBuffer(8))
      expect(result).toBe('test.png')
      expect(path.isAbsolute(result)).toBe(false)
    })

    it('copyTempToAttachment returns filename not absolute path', async () => {
      await service.initProject('Test')
      const task = makeTask()
      await service.createTask(task)

      // Create a temp file to copy
      const tempFile = path.join(os.tmpdir(), 'temp-attach-' + Date.now() + '.png')
      await fs.writeFile(tempFile, 'fake image data')

      const result = await service.copyTempToAttachment(task.id, tempFile, 'copied.png')
      expect(result).toBe('copied.png')
      expect(path.isAbsolute(result)).toBe(false)

      await fs.unlink(tempFile).catch(() => {})
    })

    it('resolveAttachmentPath resolves relative filename to absolute path', async () => {
      await service.initProject('Test')
      const resolved = service.resolveAttachmentPath('tsk_test', 'image.png')
      expect(resolved).toBe(
        path.join(tmpDir, '.familiar', 'tasks', 'tsk_test', 'attachments', 'image.png')
      )
    })

    it('resolveAttachmentPath passes through absolute paths (legacy)', () => {
      const absPath = '/old/path/image.png'
      const resolved = service.resolveAttachmentPath('tsk_test', absPath)
      expect(resolved).toBe(absPath)
    })
  })

  describe('markNotificationsByTaskIds', () => {
    it('marks notifications for multiple taskIds in a single write', async () => {
      await service.initProject('Test')
      await service.appendNotification({
        id: 'n1', title: 'A', body: '', taskId: 'tsk_a', read: false, createdAt: '2026-01-01T00:00:00.000Z'
      })
      await service.appendNotification({
        id: 'n2', title: 'B', body: '', taskId: 'tsk_b', read: false, createdAt: '2026-01-01T00:00:00.000Z'
      })
      await service.appendNotification({
        id: 'n3', title: 'C', body: '', taskId: 'tsk_c', read: false, createdAt: '2026-01-01T00:00:00.000Z'
      })

      await service.markNotificationsByTaskIds(['tsk_a', 'tsk_b'])

      const notifications = await service.readNotifications()
      expect(notifications.find((n) => n.id === 'n1')!.read).toBe(true)
      expect(notifications.find((n) => n.id === 'n2')!.read).toBe(true)
      expect(notifications.find((n) => n.id === 'n3')!.read).toBe(false)
    })

    it('does not write when no notifications match', async () => {
      await service.initProject('Test')
      await service.appendNotification({
        id: 'n1', title: 'A', body: '', taskId: 'tsk_a', read: false, createdAt: '2026-01-01T00:00:00.000Z'
      })

      await service.markNotificationsByTaskIds(['tsk_nonexistent'])

      const notifications = await service.readNotifications()
      expect(notifications[0].read).toBe(false)
    })
  })
})
