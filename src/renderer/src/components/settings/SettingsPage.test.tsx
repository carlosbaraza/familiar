import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useUIStore } from '@renderer/stores/ui-store'
import { SettingsPage } from './SettingsPage'
import { DEFAULT_SETTINGS } from '@shared/types/settings'

// Mock WorkspacesSettings to simplify tests
vi.mock('./WorkspacesSettings', () => ({
  WorkspacesSettings: () => <div data-testid="workspaces-settings">Workspaces</div>
}))

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
    mockApi.readSettings.mockResolvedValue({
      defaultCommand: 'claude --resume',
      snippets: [{ title: 'Start', command: '/familiar-agent', pressEnter: true }]
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

  it('renders Workspaces section', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })
    expect(screen.getByTestId('workspaces-settings')).toBeInTheDocument()
  })

  it('loads settings on mount and populates form', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      const input = screen.getByPlaceholderText(
        'e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions'
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
        'e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions'
      ) as HTMLInputElement
      expect(input.value).toBe(DEFAULT_SETTINGS.defaultCommand)
    })
  })

  it('does not have Save or Cancel buttons', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })

    expect(screen.queryByText('Save')).not.toBeInTheDocument()
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
  })

  it('autosaves after a change with debounce', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      expect(
        (
          screen.getByPlaceholderText(
            'e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions'
          ) as HTMLInputElement
        ).value
      ).toBe('claude --resume')
    })

    const input = screen.getByPlaceholderText(
      'e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions'
    )
    fireEvent.change(input, { target: { value: 'updated-command' } })

    // Should not save immediately
    expect(mockApi.writeSettings).not.toHaveBeenCalled()

    await waitFor(() => {
      expect(mockApi.writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultCommand: 'updated-command'
        })
      )
    })
  })

  it('debounces rapid changes and only saves once', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      expect(
        (
          screen.getByPlaceholderText(
            'e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions'
          ) as HTMLInputElement
        ).value
      ).toBe('claude --resume')
    })

    const input = screen.getByPlaceholderText(
      'e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions'
    )

    // Type multiple characters rapidly (within debounce window)
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'ab' } })
    fireEvent.change(input, { target: { value: 'abc' } })
    await waitFor(() => {
      // Should only save once with the final value
      expect(mockApi.writeSettings).toHaveBeenCalledTimes(1)
      expect(mockApi.writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultCommand: 'abc'
        })
      )
    })
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

  it('autosaves when snippets change', async () => {
    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('snippet-settings')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('change-snippets'))

    await waitFor(() => {
      expect(mockApi.writeSettings).toHaveBeenCalledOnce()
    })
  })

  it('filters out empty snippets when autosaving', async () => {
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
            'e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions'
          ) as HTMLInputElement
        ).value
      ).toBe('test')
    })

    const input = screen.getByPlaceholderText(
      'e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions'
    )
    fireEvent.change(input, { target: { value: 'test2' } })

    await waitFor(() => {
      expect(mockApi.writeSettings).toHaveBeenCalledOnce()
      const savedSettings = mockApi.writeSettings.mock.calls[0][0]
      expect(savedSettings.snippets).toHaveLength(2)
      expect(savedSettings.snippets[0].title).toBe('Valid')
      expect(savedSettings.snippets[1].title).toBe('Also Valid')
    })
  })

  it('dispatches snippets-updated custom event after autosave', async () => {
    const eventSpy = vi.fn()
    window.addEventListener('snippets-updated', eventSpy)

    await act(async () => {
      render(<SettingsPage />)
    })

    await waitFor(() => {
      expect(
        (
          screen.getByPlaceholderText(
            'e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions'
          ) as HTMLInputElement
        ).value
      ).toBe('claude --resume')
    })

    const input = screen.getByPlaceholderText(
      'e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions'
    )
    fireEvent.change(input, { target: { value: 'changed' } })

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
            'e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions'
          ) as HTMLInputElement
        ).value
      ).toBe('claude --resume')
    })

    const input = screen.getByPlaceholderText(
      'e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions'
    )
    fireEvent.change(input, { target: { value: '' } })

    await waitFor(() => {
      expect(mockApi.writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultCommand: undefined
        })
      )
    })
  })
})
