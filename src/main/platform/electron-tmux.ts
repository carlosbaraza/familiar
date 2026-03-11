import { execFile } from 'child_process'
import { ITmuxManager } from '../../shared/platform/tmux'

export class ElectronTmuxManager implements ITmuxManager {
  private _execTmux(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      execFile('tmux', args, (error, stdout, stderr) => {
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          exitCode: error ? (error as NodeJS.ErrnoException & { code?: number }).code ? 1 : 1 : 0
        })
      })
    })
  }

  private _exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('tmux', args, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`tmux ${args.join(' ')} failed: ${stderr || error.message}`))
          return
        }
        resolve(stdout.trim())
      })
    })
  }

  async listSessions(): Promise<string[]> {
    try {
      const output = await this._exec(['list-sessions', '-F', '#{session_name}'])
      if (!output) return []
      return output.split('\n').filter((s) => s.length > 0)
    } catch {
      // tmux returns error when no server is running / no sessions exist
      return []
    }
  }

  async createSession(sessionName: string, cwd: string): Promise<void> {
    await this._exec(['new-session', '-d', '-s', sessionName, '-c', cwd])
  }

  async attachSession(_sessionName: string): Promise<void> {
    // Internal tracking only — actual attachment is done via node-pty
    // spawning `tmux attach-session -t <name>`
  }

  async detachSession(_sessionName: string): Promise<void> {
    // Internal tracking only — detaching is handled by destroying the PTY
  }

  async killSession(sessionName: string): Promise<void> {
    await this._exec(['kill-session', '-t', sessionName])
  }

  async hasSession(sessionName: string): Promise<boolean> {
    const result = await this._execTmux(['has-session', '-t', sessionName])
    return result.exitCode === 0
  }

  getSessionName(taskId: string, paneIndex: number): string {
    return `kanban-${taskId}-${paneIndex}`
  }
}
