import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useUIStore } from '@renderer/stores/ui-store'
import { SettingsPage } from './SettingsPage'
import { DEFAULT_SETTINGS } from '@shared/types/settings'

// Mock SnippetSettings to simplify tests
vi.mock('./SnippetSettings', () => ({
  SnippetSettings: ({
    snippets,
    onChange
  }: {
    snippets: unknown[]
    onChange: (s: unknown[]) => void
  }) => (
    <div data-testid="snippet-settings">
      <span data-testid="snippet-count">{snippets.length}</span>
      <button
        data-testid="change-snippets"
        onClick={() =>
          onChange([{ title: 'New', command: 'echo hi', pressEnter: true }])
        }
      >
        Change
      </button>
    </div>
  )
}))

const mockApi = {
  readSettings: vi.fn(),
  writeSettings: vi.fn().mockResolvedValue(undefined)
}

;(window as any).api = mockApi

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the default mock implementation each time
    mockApi.readSettings.mockResolvedValue({
      defaultCommand: 'claude --resume',
      snippets: [{ title: 'Start', command: '/familiar', pressEnter: true }]
    })
    useUIStore.setState({
      settingsOpen: true,
      closeSettings: vi.fn()
    })
  })

  it('renders the settings page with title', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders Terminal section', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })
    expect(screen.getByText('Terminal')).toBeInTheDocument()
    expect(screen.getByText('Default Command')).toBeInTheDocument()
  })

  it('renders Snippets section', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })
    expect(screen.getByText('Snippets')).toBeInTheDocument()
    expect(screen.getByTestId('snippet-settings')).toBeInTheDocument()
  })

  it('loads settings on mount and populates form', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      const input = screen.getByPlaceholderText(
        'e.g. claude --dangerously-skip-permissions'
      ) as HTMLInputElement
      expect(input.value).toBe('claude --resume')
    })

    expect(mockApi.readSettings).toHaveBeenCalledOnce()
  })

  it('uses default settings when readSettings fails', async () => {
    mockApi.readSettings.mockRejectedValueOnce(new Error('No settings'))

    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      const input = screen.getByPlaceholderText(
        'e.g. claude --dangerously-skip-permissions'
      ) as HTMLInputElement
      // Should have the default from DEFAULT_SETTINGS
      expect(input.value).toBe(DEFAULT_SETTINGS.defaultCommand)
    })
  })

  it('Save button is disabled when there are no changes', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })

    const saveButton = screen.getByText('Save')
    expect(saveButton).toBeDisabled()
  })

  it('Save button becomes enabled after making a change', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      expect(
        (
          screen.getByPlaceholderText(
            'e.g. claude --dangerously-skip-permissions'
          ) as HTMLInputElement
        ).value
      ).toBe('claude --resume')
    })

    const input = screen.getByPlaceholderText('e.g. claude --dangerously-skip-permissions')
    fireEvent.change(input, { target: { value: 'new-command' } })

    expect(screen.getByText('Save')).not.toBeDisabled()
  })

  it('calls writeSettings on save and resets dirty state', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      expect(
        (
          screen.getByPlaceholderText(
            'e.g. claude --dangerously-skip-permissions'
          ) as HTMLInputElement
        ).value
      ).toBe('claude --resume')
    })

    const input = screen.getByPlaceholderText('e.g. claude --dangerously-skip-permissions')
    fireEvent.change(input, { target: { value: 'updated-command' } })

    await act(async () => {
      fireEvent.click(screen.getByText('Save'))
    })

    await waitFor(() => {
      expect(mockApi.writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultCommand: 'updated-command'
        })
      )
    })

    // After save, button should be disabled again
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeDisabled()
    })
  })

  it('Cancel button calls closeSettings', async () => {
    const closeSettingsFn = vi.fn()
    useUIStore.setState({ closeSettings: closeSettingsFn })

    await act(async () => {
      render(<SettingsPage />)
    })

    fireEvent.click(screen.getByText('Cancel'))
    expect(closeSettingsFn).toHaveBeenCalledOnce()
  })

  it('close X button calls closeSettings', async () => {
    const closeSettingsFn = vi.fn()
    useUIStore.setState({ closeSettings: closeSettingsFn })

    await act(async () => {
      render(<SettingsPage />)
    })

    const closeButton = screen.getByTitle('Close (Escape)')
    fireEvent.click(closeButton)
    expect(closeSettingsFn).toHaveBeenCalledOnce()
  })

  it('changing snippets marks the form as dirty', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('snippet-settings')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('change-snippets'))

    expect(screen.getByText('Save')).not.toBeDisabled()
  })

  it('filters out empty snippets before saving', async () => {
    mockApi.readSettings.mockResolvedValue({
      defaultCommand: 'test',
      snippets: [
        { title: 'Valid', command: 'echo hi', pressEnter: true },
        { title: '', command: '', pressEnter: false },
        { title: 'Also Valid', command: 'echo bye', pressEnter: true }
      ]
    })

    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      expect(
        (
          screen.getByPlaceholderText(
            'e.g. claude --dangerously-skip-permissions'
          ) as HTMLInputElement
        ).value
      ).toBe('test')
    })

    // Make dirty and save
    const input = screen.getByPlaceholderText('e.g. claude --dangerously-skip-permissions')
    fireEvent.change(input, { target: { value: 'test2' } })

    await act(async () => {
      fireEvent.click(screen.getByText('Save'))
    })

    await waitFor(() => {
      expect(mockApi.writeSettings).toHaveBeenCalledOnce()
      const savedSettings = mockApi.writeSettings.mock.calls[0][0]
      // Empty snippet should be filtered out
      expect(savedSettings.snippets).toHaveLength(2)
      expect(savedSettings.snippets[0].title).toBe('Valid')
      expect(savedSettings.snippets[1].title).toBe('Also Valid')
    })
  })

  it('dispatches snippets-updated custom event after save', async () => {
    const eventSpy = vi.fn()
    window.addEventListener('snippets-updated', eventSpy)

    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      expect(
        (
          screen.getByPlaceholderText(
            'e.g. claude --dangerously-skip-permissions'
          ) as HTMLInputElement
        ).value
      ).toBe('claude --resume')
    })

    const input = screen.getByPlaceholderText('e.g. claude --dangerously-skip-permissions')
    fireEvent.change(input, { target: { value: 'changed' } })

    await act(async () => {
      fireEvent.click(screen.getByText('Save'))
    })

    await waitFor(() => {
      expect(eventSpy).toHaveBeenCalledOnce()
    })

    window.removeEventListener('snippets-updated', eventSpy)
  })

  it('clears defaultCommand when input is emptied', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      expect(
        (
          screen.getByPlaceholderText(
            'e.g. claude --dangerously-skip-permissions'
          ) as HTMLInputElement
        ).value
      ).toBe('claude --resume')
    })

    const input = screen.getByPlaceholderText('e.g. claude --dangerously-skip-permissions')
    fireEvent.change(input, { target: { value: '' } })

    await act(async () => {
      fireEvent.click(screen.getByText('Save'))
    })

    await waitFor(() => {
      expect(mockApi.writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultCommand: undefined
        })
      )
    })
  })
})
