import * as pty from 'node-pty'
import { IPtyManager } from '../../shared/platform/pty'
import { ElectronTmuxManager } from './electron-tmux'

interface PtySession {
  id: string
  taskId: string
  paneId: string
  tmuxSessionName: string
  ptyProcess: pty.IPty
}

type DataCallback = (sessionId: string, data: string) => void

export class ElectronPtyManager implements IPtyManager {
  private _sessions = new Map<string, PtySession>()
  private _dataListeners = new Set<DataCallback>()
  private _nextId = 0

  constructor(private _tmux: ElectronTmuxManager) {}

  async create(taskId: string, paneId: string, cwd: string): Promise<string> {
    // Derive pane index from paneId (use a simple counter-based approach)
    const paneIndex = this._nextId
    const tmuxSessionName = this._tmux.getSessionName(taskId, paneIndex)

    // Create tmux session if it doesn't already exist
    const exists = await this._tmux.hasSession(tmuxSessionName)
    if (!exists) {
      await this._tmux.createSession(tmuxSessionName, cwd)
    }

    // Spawn node-pty process that attaches to the tmux session
    const ptyProcess = pty.spawn('tmux', ['attach-session', '-t', tmuxSessionName], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: process.env as Record<string, string>
    })

    const sessionId = `pty-${this._nextId++}`
    const session: PtySession = {
      id: sessionId,
      taskId,
      paneId,
      tmuxSessionName,
      ptyProcess
    }

    this._sessions.set(sessionId, session)

    // Forward data from this PTY to all registered listeners
    ptyProcess.onData((data: string) => {
      for (const listener of this._dataListeners) {
        listener(sessionId, data)
      }
    })

    return sessionId
  }

  async write(sessionId: string, data: string): Promise<void> {
    const session = this._sessions.get(sessionId)
    if (!session) {
      throw new Error(`PTY session not found: ${sessionId}`)
    }
    session.ptyProcess.write(data)
  }

  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    const session = this._sessions.get(sessionId)
    if (!session) {
      throw new Error(`PTY session not found: ${sessionId}`)
    }
    session.ptyProcess.resize(cols, rows)
  }

  async destroy(sessionId: string): Promise<void> {
    const session = this._sessions.get(sessionId)
    if (!session) {
      return
    }
    // Kill the PTY process but leave the tmux session alive for persistence
    session.ptyProcess.kill()
    this._sessions.delete(sessionId)
  }

  onData(callback: DataCallback): () => void {
    this._dataListeners.add(callback)
    return () => {
      this._dataListeners.delete(callback)
    }
  }
}
