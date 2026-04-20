import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process so execFile / execFileSync never actually run tmux
vi.mock('child_process', () => {
  const execFileMock = vi.fn(
    (
      _path: string,
      _args: string[],
      cb: (err: Error | null, stdout: string, stderr: string) => void
    ) => {
      cb(null, '', '')
    }
  )
  const execFileSyncMock = vi.fn(() => '/usr/local/bin/tmux')
  return {
    execFile: execFileMock,
    execFileSync: execFileSyncMock,
    default: { execFile: execFileMock, execFileSync: execFileSyncMock }
  }
})

// Mock fs so findTmuxPath finds the mocked tmux binary
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => true)
  }
})

import { execFile } from 'child_process'
import { ElectronTmuxManager } from './electron-tmux'

type ExecFileCall = [string, string[], (err: Error | null, stdout: string, stderr: string) => void]

function getExecFileCalls(): ExecFileCall[] {
  return (execFile as unknown as ReturnType<typeof vi.fn>).mock.calls as ExecFileCall[]
}

function getSendKeysCalls(): string[][] {
  return getExecFileCalls()
    .map(([, args]) => args)
    .filter((args) => args[0] === 'send-keys')
}

describe('ElectronTmuxManager.createSession', () => {
  beforeEach(() => {
    ;(execFile as unknown as ReturnType<typeof vi.fn>).mockClear()
  })

  it('passes HISTCONTROL=ignorespace:ignoredups to tmux -e so bash ignores space-prefixed commands', async () => {
    const mgr = new ElectronTmuxManager()
    await mgr.createSession('familiar-test', '/tmp', { FAMILIAR_TASK_ID: 'tsk_abc' })

    const newSessionCall = getExecFileCalls().find(([, args]) => args.includes('new-session'))
    expect(newSessionCall).toBeDefined()
    const args = newSessionCall![1]

    // Find the -e HISTCONTROL=... pair
    const histIdx = args.findIndex((a) => a === 'HISTCONTROL=ignorespace:ignoredups')
    expect(histIdx).toBeGreaterThan(0)
    expect(args[histIdx - 1]).toBe('-e')
  })

  it('passes user-supplied FAMILIAR_* env vars via -e flags', async () => {
    const mgr = new ElectronTmuxManager()
    await mgr.createSession('familiar-test', '/tmp', {
      FAMILIAR_TASK_ID: 'tsk_xyz',
      FAMILIAR_PROJECT_ROOT: '/path/to/project'
    })

    const newSessionCall = getExecFileCalls().find(([, args]) => args.includes('new-session'))
    const args = newSessionCall![1]

    expect(args).toContain('FAMILIAR_TASK_ID=tsk_xyz')
    expect(args).toContain('FAMILIAR_PROJECT_ROOT=/path/to/project')
  })
})

describe('ElectronTmuxManager.warmupSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(execFile as unknown as ReturnType<typeof vi.fn>).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not send `export FAMILIAR_*` commands (env vars are already set via tmux -e)', async () => {
    const mgr = new ElectronTmuxManager()
    const warmup = mgr.warmupSession(
      'familiar-test',
      { FAMILIAR_TASK_ID: 'tsk_abc', FAMILIAR_PROJECT_ROOT: '/p' },
      'claude --resume abc'
    )

    await vi.advanceTimersByTimeAsync(6000)
    await warmup

    const sentTexts = getSendKeysCalls().flat()
    const exportLines = sentTexts.filter((t) => typeof t === 'string' && t.startsWith('export '))
    expect(exportLines).toHaveLength(0)
  })

  it('sends `clear` with a leading space so it is hidden from shell history', async () => {
    const mgr = new ElectronTmuxManager()
    const warmup = mgr.warmupSession('familiar-test', {}, undefined)

    await vi.advanceTimersByTimeAsync(6000)
    await warmup

    const sendKeysArgs = getSendKeysCalls()
    const clearCall = sendKeysArgs.find((args) => args.some((a) => a === ' clear'))
    expect(clearCall).toBeDefined()
    // Must be exactly ' clear' with the leading space, not 'clear'
    expect(sendKeysArgs.some((args) => args.includes('clear') && !args.includes(' clear'))).toBe(
      false
    )
  })

  it('sends the initial command with a leading space so it is hidden from shell history', async () => {
    const mgr = new ElectronTmuxManager()
    const warmup = mgr.warmupSession('familiar-test', {}, 'claude --resume abc')

    await vi.advanceTimersByTimeAsync(6000)
    await warmup

    const sendKeysArgs = getSendKeysCalls()
    const commandCall = sendKeysArgs.find((args) =>
      args.some((a) => a === ' claude --resume abc')
    )
    expect(commandCall).toBeDefined()
  })

  it('skips the command send-keys call when no command is provided', async () => {
    const mgr = new ElectronTmuxManager()
    const warmup = mgr.warmupSession('familiar-test', {}, undefined)

    await vi.advanceTimersByTimeAsync(6000)
    await warmup

    const sendKeysArgs = getSendKeysCalls()
    // We expect C-c dismissal and ` clear` — but nothing resembling a user command
    const nonControlSends = sendKeysArgs.filter(
      (args) => !args.includes('C-c') && !args.some((a) => a === ' clear')
    )
    expect(nonControlSends).toHaveLength(0)
  })
})
