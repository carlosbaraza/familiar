import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { TaskFiles } from './TaskFiles'

const mockApi = {
  listTaskFiles: vi.fn(),
  watchProjectDir: vi.fn(),
  getProjectRoot: vi.fn(),
  openPath: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).api = { ...((window as any).api ?? {}), ...mockApi }
  mockApi.listTaskFiles.mockResolvedValue([])
  mockApi.watchProjectDir.mockReturnValue(() => {})
  mockApi.getProjectRoot.mockResolvedValue('/project')
  mockApi.openPath.mockResolvedValue('')
})

describe('TaskFiles', () => {
  it('shows empty state when no files', async () => {
    render(<TaskFiles taskId="tsk_abc" />)

    await waitFor(() => {
      expect(screen.getByText('No files yet')).toBeInTheDocument()
    })
  })

  it('renders file list', async () => {
    mockApi.listTaskFiles.mockResolvedValue([
      { name: 'attachments', size: 0, isDir: true, path: '/project/.familiar/tasks/tsk_abc/attachments' },
      { name: 'document.md', size: 256, isDir: false, path: '/project/.familiar/tasks/tsk_abc/document.md' }
    ])

    render(<TaskFiles taskId="tsk_abc" />)

    await waitFor(() => {
      expect(screen.getByText('attachments')).toBeInTheDocument()
    })
    expect(screen.getByText('document.md')).toBeInTheDocument()
    expect(screen.getByText('256 B')).toBeInTheDocument()
  })

  it('renders header with title and open folder button', async () => {
    render(<TaskFiles taskId="tsk_abc" />)

    await waitFor(() => {
      expect(screen.getByText('Task Files')).toBeInTheDocument()
    })
    expect(screen.getByText('Open Folder')).toBeInTheDocument()
  })

  it('opens task folder on button click', async () => {
    render(<TaskFiles taskId="tsk_abc" />)

    await waitFor(() => {
      expect(screen.getByText('Open Folder')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Open Folder'))

    await waitFor(() => {
      expect(mockApi.getProjectRoot).toHaveBeenCalled()
      expect(mockApi.openPath).toHaveBeenCalledWith('/project/.familiar/tasks/tsk_abc')
    })
  })

  it('opens file on click', async () => {
    mockApi.listTaskFiles.mockResolvedValue([
      { name: 'document.md', size: 100, isDir: false, path: '/project/.familiar/tasks/tsk_abc/document.md' }
    ])

    render(<TaskFiles taskId="tsk_abc" />)

    await waitFor(() => {
      expect(screen.getByText('document.md')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('document.md'))

    expect(mockApi.openPath).toHaveBeenCalledWith('/project/.familiar/tasks/tsk_abc/document.md')
  })

  it('shows file sizes in human-readable format', async () => {
    mockApi.listTaskFiles.mockResolvedValue([
      { name: 'small.txt', size: 500, isDir: false, path: '/p/small.txt' },
      { name: 'medium.txt', size: 2048, isDir: false, path: '/p/medium.txt' },
      { name: 'large.bin', size: 1048576, isDir: false, path: '/p/large.bin' }
    ])

    render(<TaskFiles taskId="tsk_abc" />)

    await waitFor(() => {
      expect(screen.getByText('500 B')).toBeInTheDocument()
    })
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
    expect(screen.getByText('1.0 MB')).toBeInTheDocument()
  })

  it('does not show size for directories', async () => {
    mockApi.listTaskFiles.mockResolvedValue([
      { name: 'attachments', size: 0, isDir: true, path: '/p/attachments' }
    ])

    render(<TaskFiles taskId="tsk_abc" />)

    await waitFor(() => {
      expect(screen.getByText('attachments')).toBeInTheDocument()
    })
    // Should not render "0 B" for directory
    expect(screen.queryByText('0 B')).not.toBeInTheDocument()
  })

  it('subscribes to file watcher on mount', async () => {
    render(<TaskFiles taskId="tsk_abc" />)

    await waitFor(() => {
      expect(mockApi.watchProjectDir).toHaveBeenCalled()
    })
  })
})
