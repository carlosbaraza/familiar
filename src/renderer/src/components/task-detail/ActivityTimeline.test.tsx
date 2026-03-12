import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ActivityTimeline } from './ActivityTimeline'
import type { ActivityEntry } from '@shared/types'

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: () => 'mock_id1'
}))

const mockEntries: ActivityEntry[] = [
  { id: 'e1', timestamp: new Date().toISOString(), type: 'created', message: 'Task created' },
  {
    id: 'e2',
    timestamp: new Date().toISOString(),
    type: 'status_change',
    message: 'Status changed to in-progress'
  }
]

const mockApi = {
  readTaskActivity: vi.fn(),
  appendActivity: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).api = { ...((window as any).api ?? {}), ...mockApi }
  mockApi.readTaskActivity.mockResolvedValue([])
  mockApi.appendActivity.mockResolvedValue(undefined)
})

describe('ActivityTimeline', () => {
  it('renders the Activity header', () => {
    render(<ActivityTimeline taskId="tsk_abc" />)
    expect(screen.getByText('Activity')).toBeInTheDocument()
  })

  it('shows empty state when no entries', async () => {
    render(<ActivityTimeline taskId="tsk_abc" />)
    await waitFor(() => {
      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    })
  })

  it('loads and displays activity entries', async () => {
    mockApi.readTaskActivity.mockResolvedValue(mockEntries)
    render(<ActivityTimeline taskId="tsk_abc" />)

    await waitFor(() => {
      expect(screen.getByText('Task created')).toBeInTheDocument()
      expect(screen.getByText('Status changed to in-progress')).toBeInTheDocument()
    })
    expect(mockApi.readTaskActivity).toHaveBeenCalledWith('tsk_abc')
  })

  it('renders input field and send button', () => {
    render(<ActivityTimeline taskId="tsk_abc" />)
    expect(screen.getByPlaceholderText('Add a note...')).toBeInTheDocument()
    expect(screen.getByText('Send')).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<ActivityTimeline taskId="tsk_abc" />)
    const sendButton = screen.getByText('Send')
    expect(sendButton).toBeDisabled()
  })

  it('send button is enabled when input has text', () => {
    render(<ActivityTimeline taskId="tsk_abc" />)
    const input = screen.getByPlaceholderText('Add a note...')
    fireEvent.change(input, { target: { value: 'My note' } })
    const sendButton = screen.getByText('Send')
    expect(sendButton).not.toBeDisabled()
  })

  it('adds a note when clicking Send', async () => {
    mockApi.appendActivity.mockResolvedValue(undefined)
    render(<ActivityTimeline taskId="tsk_abc" />)

    const input = screen.getByPlaceholderText('Add a note...')
    fireEvent.change(input, { target: { value: 'My new note' } })
    fireEvent.click(screen.getByText('Send'))

    await waitFor(() => {
      expect(mockApi.appendActivity).toHaveBeenCalledWith(
        'tsk_abc',
        expect.objectContaining({
          type: 'note',
          message: 'My new note'
        })
      )
    })

    // Input should be cleared
    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })

  it('adds a note when pressing Enter', async () => {
    render(<ActivityTimeline taskId="tsk_abc" />)

    const input = screen.getByPlaceholderText('Add a note...')
    fireEvent.change(input, { target: { value: 'Enter note' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockApi.appendActivity).toHaveBeenCalledWith(
        'tsk_abc',
        expect.objectContaining({
          type: 'note',
          message: 'Enter note'
        })
      )
    })
  })

  it('does not add a note on Shift+Enter', () => {
    render(<ActivityTimeline taskId="tsk_abc" />)

    const input = screen.getByPlaceholderText('Add a note...')
    fireEvent.change(input, { target: { value: 'Some text' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    expect(mockApi.appendActivity).not.toHaveBeenCalled()
  })

  it('does not send when input is only whitespace', () => {
    render(<ActivityTimeline taskId="tsk_abc" />)

    const input = screen.getByPlaceholderText('Add a note...')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(screen.getByText('Send'))

    expect(mockApi.appendActivity).not.toHaveBeenCalled()
  })

  it('handles readTaskActivity failure gracefully', async () => {
    mockApi.readTaskActivity.mockRejectedValue(new Error('File not found'))
    render(<ActivityTimeline taskId="tsk_abc" />)

    await waitFor(() => {
      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    })
  })

  it('handles appendActivity failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApi.appendActivity.mockRejectedValue(new Error('Write failed'))
    render(<ActivityTimeline taskId="tsk_abc" />)

    const input = screen.getByPlaceholderText('Add a note...')
    fireEvent.change(input, { target: { value: 'My note' } })
    fireEvent.click(screen.getByText('Send'))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to add note:', expect.any(Error))
    })
    consoleSpy.mockRestore()
  })
})
