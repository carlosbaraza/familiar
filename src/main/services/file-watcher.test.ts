import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { FileWatcher } from './file-watcher'

// Mock BrowserWindow
function createMockWindow(): any {
  return {
    webContents: {
      send: vi.fn()
    }
  }
}

describe('FileWatcher', () => {
  let tmpDir: string
  let dataDir: string
  let mockWindow: any
  let watcher: FileWatcher

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-watcher-test-'))
    dataDir = path.join(tmpDir, '.familiar')
    await fs.mkdir(dataDir, { recursive: true })
    mockWindow = createMockWindow()
    watcher = new FileWatcher(tmpDir, mockWindow)
  })

  afterEach(async () => {
    watcher.stop()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('emits project:file-changed when a file is written', async () => {
    watcher.start()

    // Give chokidar time to initialize its watchers
    await new Promise((r) => setTimeout(r, 500))

    // Write a file to trigger the watcher
    await fs.writeFile(path.join(dataDir, 'state.json'), '{}')

    // Wait for debounce (500ms) + detection time
    await vi.waitFor(
      () => {
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('project:file-changed', tmpDir)
      },
      { timeout: 3000 }
    )
  })

  it('detects atomic writes (temp file + rename)', async () => {
    watcher.start()

    // Simulate atomic write like the CLI does
    const tmpFile = path.join(dataDir, '.tmp-123-abc')
    await fs.writeFile(tmpFile, '{"tasks":[]}')
    await fs.rename(tmpFile, path.join(dataDir, 'state.json'))

    await vi.waitFor(
      () => {
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('project:file-changed', tmpDir)
      },
      { timeout: 3000 }
    )
  })

  it('debounces rapid file changes into a single event', async () => {
    watcher.start()

    // Write multiple files rapidly (like CLI updating task.json, state.json, activity.json)
    await fs.writeFile(path.join(dataDir, 'state.json'), '{}')
    await fs.writeFile(path.join(dataDir, 'other.json'), '{}')
    await fs.writeFile(path.join(dataDir, 'another.json'), '{}')

    // Wait for debounce to settle
    await new Promise((r) => setTimeout(r, 1500))

    // Should have been called only once due to debouncing
    expect(mockWindow.webContents.send).toHaveBeenCalledTimes(1)
  })

  it('suppresses events when selfTriggered is set', async () => {
    watcher.start()

    watcher.markSelfTriggered()
    await fs.writeFile(path.join(dataDir, 'state.json'), '{}')

    // Wait longer than debounce
    await new Promise((r) => setTimeout(r, 1500))

    expect(mockWindow.webContents.send).not.toHaveBeenCalled()
  })

  it('resumes events after clearSelfTriggered', async () => {
    watcher.start()

    watcher.markSelfTriggered()
    watcher.clearSelfTriggered()

    // Wait for the 1s timeout in clearSelfTriggered
    await new Promise((r) => setTimeout(r, 1200))

    await fs.writeFile(path.join(dataDir, 'state.json'), '{}')

    await vi.waitFor(
      () => {
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('project:file-changed', tmpDir)
      },
      { timeout: 3000 }
    )
  })

  it('stops watching after stop() is called', async () => {
    watcher.start()
    watcher.stop()

    await fs.writeFile(path.join(dataDir, 'state.json'), '{}')

    await new Promise((r) => setTimeout(r, 1500))

    expect(mockWindow.webContents.send).not.toHaveBeenCalled()
  })
})
