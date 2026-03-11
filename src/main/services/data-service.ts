import { ElectronFileSystem } from '../platform/electron-file-system'
import type { ProjectState, Task, ActivityEntry } from '../../shared/types'
import {
  DATA_DIR,
  STATE_FILE,
  TASKS_DIR,
  TASK_FILE,
  DOCUMENT_FILE,
  ACTIVITY_FILE,
  ATTACHMENTS_DIR,
  DEFAULT_COLUMNS
} from '../../shared/constants'
import path from 'path'

export class DataService {
  private fs: ElectronFileSystem
  private projectRoot: string

  constructor(projectRoot: string) {
    this.fs = new ElectronFileSystem()
    this.projectRoot = projectRoot
  }

  private getDataPath(...segments: string[]): string {
    return path.join(this.projectRoot, DATA_DIR, ...segments)
  }

  // ─── Project state ────────────────────────────────────────────────

  async readProjectState(): Promise<ProjectState> {
    const filePath = this.getDataPath(STATE_FILE)
    const raw = await this.fs.readFile(filePath)
    return JSON.parse(raw) as ProjectState
  }

  async writeProjectState(state: ProjectState): Promise<void> {
    const filePath = this.getDataPath(STATE_FILE)
    await this.fs.writeFileAtomic(filePath, JSON.stringify(state, null, 2))
  }

  // ─── Task CRUD ────────────────────────────────────────────────────

  async createTask(task: Task): Promise<void> {
    const taskDir = this.getDataPath(TASKS_DIR, task.id)
    await this.fs.mkdir(taskDir, true)

    // task.json
    await this.fs.writeFile(
      path.join(taskDir, TASK_FILE),
      JSON.stringify(task, null, 2)
    )

    // empty document.md
    await this.fs.writeFile(path.join(taskDir, DOCUMENT_FILE), '')

    // empty activity.json
    await this.fs.writeFile(
      path.join(taskDir, ACTIVITY_FILE),
      JSON.stringify([], null, 2)
    )
  }

  async readTask(taskId: string): Promise<Task> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, TASK_FILE)
    const raw = await this.fs.readFile(filePath)
    return JSON.parse(raw) as Task
  }

  async updateTask(task: Task): Promise<void> {
    const filePath = this.getDataPath(TASKS_DIR, task.id, TASK_FILE)
    await this.fs.writeFileAtomic(filePath, JSON.stringify(task, null, 2))
  }

  async deleteTask(taskId: string): Promise<void> {
    const taskDir = this.getDataPath(TASKS_DIR, taskId)
    await this.fs.remove(taskDir)
  }

  // ─── Document ─────────────────────────────────────────────────────

  async readTaskDocument(taskId: string): Promise<string> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, DOCUMENT_FILE)
    return this.fs.readFile(filePath)
  }

  async writeTaskDocument(taskId: string, content: string): Promise<void> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, DOCUMENT_FILE)
    await this.fs.writeFile(filePath, content)
  }

  // ─── Activity ─────────────────────────────────────────────────────

  async readTaskActivity(taskId: string): Promise<ActivityEntry[]> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, ACTIVITY_FILE)
    try {
      const raw = await this.fs.readFile(filePath)
      return JSON.parse(raw) as ActivityEntry[]
    } catch {
      return []
    }
  }

  async appendActivity(taskId: string, entry: ActivityEntry): Promise<void> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, ACTIVITY_FILE)
    const entries = await this.readTaskActivity(taskId)
    entries.push(entry)
    await this.fs.writeFile(filePath, JSON.stringify(entries, null, 2))
  }

  // ─── Attachments ──────────────────────────────────────────────────

  async saveAttachment(
    taskId: string,
    fileName: string,
    data: ArrayBuffer
  ): Promise<string> {
    const attachDir = this.getDataPath(TASKS_DIR, taskId, ATTACHMENTS_DIR)
    await this.fs.mkdir(attachDir, true)
    const filePath = path.join(attachDir, fileName)
    const { writeFile } = await import('fs/promises')
    await writeFile(filePath, Buffer.from(data))
    return filePath
  }

  // ─── Init ─────────────────────────────────────────────────────────

  async initProject(projectName: string): Promise<ProjectState> {
    const dataDir = this.getDataPath()
    await this.fs.mkdir(dataDir, true)
    await this.fs.mkdir(this.getDataPath(TASKS_DIR), true)

    const state: ProjectState = {
      version: 1,
      projectName,
      tasks: [],
      columnOrder: [...DEFAULT_COLUMNS],
      labels: []
    }

    await this.writeProjectState(state)
    return state
  }

  async isInitialized(): Promise<boolean> {
    const stateFile = this.getDataPath(STATE_FILE)
    return this.fs.exists(stateFile)
  }
}
