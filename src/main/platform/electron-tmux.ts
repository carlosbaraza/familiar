import { execFile, execFileSync } from 'child_process'
import * as fs from 'fs'
import { ITmuxManager } from '../../shared/platform/tmux'

/**
 * Resolve the full path to the tmux binary.
 * Electron apps launched from Finder/Dock often have a minimal PATH
 * that doesn't include Homebrew or other user-installed binaries.
 */
function findTmuxPath(): string {
  // Try which first
  try {
    const resolved = execFileSync('which', ['tmux'], {
      encoding: 'utf-8',
      timeout: 3000
    }).trim()
    if (resolved && fs.existsSync(resolved)) return resolved
  } catch {
    // fall through
  }

  // Check common macOS paths
  const candidates = [
    '/opt/homebrew/bin/tmux',
    '/usr/local/bin/tmux',
    '/usr/bin/tmux',
    '/opt/local/bin/tmux'
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  // Last resort: bare name (will rely on PATH)
  return 'tmux'
}

export class ElectronTmuxManager implements ITmuxManager {
  private _tmuxPath: string
  /** Tracks sessions currently being warmed up to prevent duplicate warmups */
  private _warmingUp = new Set<string>()

  constructor() {
    this._tmuxPath = findTmuxPath()
  }

  private _execTmux(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      execFile(this._tmuxPath, args, (error, stdout, stderr) => {
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          exitCode: error ? 1 : 0
        })
      })
    })
  }

  private _exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(this._tmuxPath, args, (error, stdout, stderr) => {
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

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async createSession(sessionName: string, cwd: string, env?: Record<string, string>): Promise<void> {
    // Resolve the user's preferred shell. Electron apps launched from Finder/Dock
    // get a minimal environment, and tmux's compiled-in default-shell is often
    // /bin/bash rather than the user's login shell, so we must set it explicitly.
    const userShell = process.env.SHELL || '/bin/zsh'

    // Build the new-session command. Use -e flags to inject env vars into the
    // initial window's environment so they're available when .zshrc/.bashrc loads.
    // This is critical because set-environment only affects NEW windows/panes,
    // not the shell already running in the first window.
    //
    // -u forces UTF-8 mode so Unicode characters render correctly even when
    // Electron is launched from Finder with a minimal locale environment.
    //
    // The user's shell is passed as the shell-command argument so the first
    // window always runs the correct shell. Without this, tmux uses its
    // compiled-in default-shell (often /bin/bash on macOS), especially when
    // no tmux server is running yet (set-option -g default-shell fails if
    // there's no server to connect to).
    const args = ['-u', 'new-session', '-d', '-s', sessionName, '-c', cwd]

    // Suppress oh-my-zsh update prompt — it blocks shell init and breaks
    // the warmup sequence. The env var is set via -e so it's available
    // before .zshrc is sourced.
    args.push('-e', 'DISABLE_AUTO_UPDATE=true')

    // Tell bash to exclude space-prefixed commands from history so the
    // warmup `clear` + agent command (both sent with a leading space) don't
    // pollute the user's shell history. zsh users need `setopt HIST_IGNORE_SPACE`
    // in their .zshrc for the same behavior (no env-var equivalent exists).
    args.push('-e', 'HISTCONTROL=ignorespace:ignoredups')

    if (env) {
      for (const [key, value] of Object.entries(env)) {
        args.push('-e', `${key}=${value}`)
      }
    }
    args.push(userShell)
    await this._exec(args)

    // Now that the server is running, set default-shell globally so any
    // future windows/panes also use the user's shell.
    await this._execTmux(['set-option', '-g', 'default-shell', userShell])

    // Enable extended keys so Shift+Enter, Ctrl+Enter etc. are forwarded to inner apps.
    // "always" sends unconditionally without the inner app needing to request them.
    await this._execTmux(['set-option', '-t', sessionName, '-s', 'extended-keys', 'always'])

    // Also register env vars at the tmux session level for future windows/panes.
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        await this._execTmux(['set-environment', '-t', sessionName, key, value])
      }
    }
  }

  /**
   * Wait for the shell to finish initializing (e.g. oh-my-zsh, .zshrc),
   * then run the initial command in the already-running shell.
   * Designed to be called fire-and-forget after the PTY is already attached.
   *
   * IMPORTANT: We do NOT send Ctrl-C to dismiss prompts — doing so interrupts
   * .zshrc/.bashrc sourcing (especially oh-my-zsh), leaving the shell in an
   * uninitialized state with no PATH, no prompt theme, etc.
   *
   * FAMILIAR_* env vars are NOT re-exported here: they're already injected into
   * the shell's environment via `tmux new-session -e` in createSession(). The
   * `env` parameter is kept for API compatibility and to allow tests/callers
   * to assert on it, but its values are not sent to the shell.
   *
   * Commands are sent with a leading space so that shells with history-ignore-
   * space enabled (bash via HISTCONTROL=ignorespace — set by createSession —
   * or zsh via `setopt HIST_IGNORE_SPACE` in .zshrc) do not record them and
   * pollute the user's shell history.
   */
  async warmupSession(
    sessionName: string,
    _env?: Record<string, string>,
    command?: string
  ): Promise<void> {
    // Prevent duplicate concurrent warmups — both tmux:warmup IPC handler
    // and ptyCreate() can trigger this for the same session.
    if (this._warmingUp.has(sessionName)) return
    this._warmingUp.add(sessionName)

    try {
      // Wait for the shell to finish initializing (.zshrc, oh-my-zsh, etc.)
      // before sending Ctrl-C. Shell frameworks can take 2-4 seconds to load;
      // sending Ctrl-C too early interrupts .zshrc sourcing and leaves the
      // shell without PATH, prompt theme, aliases, etc.
      await this._delay(5000)

      // Dismiss any lingering interactive prompts (e.g. oh-my-zsh update)
      await this._execTmux(['send-keys', '-t', sessionName, 'C-c'])
      await this._delay(500)

      // Clear the screen (leading space hides from history — see method docs)
      await this._exec(['send-keys', '-t', sessionName, ' clear', 'Enter'])

      // Run the initial command if provided (leading space hides from history)
      if (command) {
        await this._exec(['send-keys', '-t', sessionName, ` ${command}`, 'Enter'])
      }
    } finally {
      this._warmingUp.delete(sessionName)
    }
  }

  async setEnvironment(sessionName: string, env: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(env)) {
      await this._execTmux(['set-environment', '-t', sessionName, key, value])
    }
  }

  async attachSession(_sessionName: string): Promise<void> {
    // Internal tracking only — actual attachment is done via node-pty
    // spawning `tmux attach-session -t <name>`
  }

  async detachSession(_sessionName: string): Promise<void> {
    // Internal tracking only — detaching is handled by destroying the PTY
  }

  async sendKeys(sessionName: string, keys: string, pressEnter = true): Promise<void> {
    // Send the text first. We intentionally do NOT include Enter in the same
    // send-keys call because TUI apps (e.g. Codex, oh-my-posh prompt apps)
    // that enable bracketed paste mode will treat the Enter inside the paste
    // block as a literal newline rather than as a submit keypress.
    //
    // Use `-l` (literal) so tmux doesn't try to interpret words in the text
    // as key names (e.g. a snippet text containing "Enter" as a literal word
    // would otherwise be sent as the Enter key).
    await this._exec(['send-keys', '-t', sessionName, '-l', keys])
    if (pressEnter) {
      // Wait long enough for the TUI app to finish processing the paste and
      // exit bracketed-paste mode before delivering Enter as its own key.
      // 150ms is conservative but reliable across TUIs (Codex, oh-my-posh, etc).
      await new Promise((resolve) => setTimeout(resolve, 150))
      await this._exec(['send-keys', '-t', sessionName, 'Enter'])
    }
  }

  async killSession(sessionName: string): Promise<void> {
    await this._exec(['kill-session', '-t', sessionName])
  }

  async hasSession(sessionName: string): Promise<boolean> {
    const result = await this._execTmux(['has-session', '-t', sessionName])
    return result.exitCode === 0
  }

  getSessionName(taskId: string, paneIndex: number): string {
    return `familiar-${taskId}-${paneIndex}`
  }
}
