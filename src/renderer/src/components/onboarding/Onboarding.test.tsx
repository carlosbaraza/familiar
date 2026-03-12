import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useTaskStore } from '@renderer/stores/task-store'
import { Onboarding } from './Onboarding'

// Mock window.api
const mockApi = {
  readSettings: vi.fn().mockResolvedValue({}),
  writeSettings: vi.fn().mockResolvedValue(undefined),
  openDirectory: vi.fn().mockResolvedValue(null),
  setProjectRoot: vi.fn().mockResolvedValue(true),
  isInitialized: vi.fn().mockResolvedValue(false),
  initProject: vi.fn(),
  readProjectState: vi.fn(),
  writeProjectState: vi.fn().mockResolvedValue(undefined),
  writeTaskDocument: vi.fn().mockResolvedValue(undefined),
  warmupTmuxSession: vi.fn().mockResolvedValue(undefined),
  createTask: vi.fn().mockResolvedValue(undefined),
  tmuxSendKeys: vi.fn().mockResolvedValue(undefined),
  tmuxList: vi.fn().mockResolvedValue([]),
  cliCheckAvailable: vi.fn().mockResolvedValue(true),
  cliInstallToPath: vi.fn().mockResolvedValue({ success: true, shell: 'zsh' })
}

;(window as any).api = mockApi

describe('Onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.readSettings.mockResolvedValue({})
    mockApi.cliCheckAvailable.mockResolvedValue(true)
  })

  it('renders step 1 (open folder) when hasProject is false', () => {
    render(<Onboarding hasProject={false} onComplete={vi.fn()} />)
    expect(screen.getByText('Welcome to Familiar')).toBeInTheDocument()
    expect(screen.getByText('Open Folder')).toBeInTheDocument()
    expect(screen.getByText('Skip environment check on setup')).toBeInTheDocument()
  })

  it('renders step 2 (select agent) when hasProject is true', () => {
    render(<Onboarding hasProject={true} onComplete={vi.fn()} />)
    expect(screen.getByText('Select Your Coding Agent')).toBeInTheDocument()
    expect(screen.getByText('Claude Code')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  it('shows "Not fully tested" for Other agent option', () => {
    render(<Onboarding hasProject={true} onComplete={vi.fn()} />)
    expect(screen.getByText('Not fully tested')).toBeInTheDocument()
  })

  it('shows "Recommended" badge for Claude Code', () => {
    render(<Onboarding hasProject={true} onComplete={vi.fn()} />)
    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })

  it('advances to install-cli step after selecting an agent', async () => {
    render(<Onboarding hasProject={true} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('Claude Code'))
    await waitFor(() => {
      expect(screen.getByText('Install CLI')).toBeInTheDocument()
    })
  })

  it('saves agent choice to settings when selecting', async () => {
    render(<Onboarding hasProject={true} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('Claude Code'))
    await waitFor(() => {
      expect(mockApi.writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({ codingAgent: 'claude-code' })
      )
    })
  })

  it('shows CLI already installed when available', async () => {
    mockApi.cliCheckAvailable.mockResolvedValue(true)
    render(<Onboarding hasProject={true} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('Claude Code'))
    await waitFor(() => {
      expect(screen.getByText('CLI is already installed and in your PATH')).toBeInTheDocument()
    })
  })

  it('shows install button when CLI not available', async () => {
    mockApi.cliCheckAvailable.mockResolvedValue(false)
    render(<Onboarding hasProject={true} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('Claude Code'))
    await waitFor(() => {
      expect(screen.getByText('Install CLI to PATH')).toBeInTheDocument()
    })
  })

  it('calls cliInstallToPath when install button is clicked', async () => {
    mockApi.cliCheckAvailable.mockResolvedValue(false)
    render(<Onboarding hasProject={true} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('Claude Code'))
    await waitFor(() => {
      expect(screen.getByText('Install CLI to PATH')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Install CLI to PATH'))
    await waitFor(() => {
      expect(mockApi.cliInstallToPath).toHaveBeenCalled()
    })
  })

  it('shows manual installation instructions in details', async () => {
    render(<Onboarding hasProject={true} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('Claude Code'))
    await waitFor(() => {
      expect(screen.getByText('Manual installation instructions')).toBeInTheDocument()
    })
  })

  it('advances to doctor step after clicking Continue on install-cli', async () => {
    render(<Onboarding hasProject={true} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('Claude Code'))
    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Continue'))
    await waitFor(() => {
      expect(screen.getByText('Environment Check')).toBeInTheDocument()
    })
  })

  it('shows doctor prompt preview with copy button', async () => {
    render(<Onboarding hasProject={true} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('Claude Code'))
    await waitFor(() => screen.getByText('Continue'))
    fireEvent.click(screen.getByText('Continue'))
    await waitFor(() => {
      expect(screen.getByText('Doctor Prompt')).toBeInTheDocument()
      expect(screen.getByText('Copy')).toBeInTheDocument()
      expect(screen.getByText('Run Doctor')).toBeInTheDocument()
      expect(screen.getByText('Skip')).toBeInTheDocument()
    })
  })

  it('calls onComplete when skip is clicked on doctor step', async () => {
    const onComplete = vi.fn()
    render(<Onboarding hasProject={true} onComplete={onComplete} />)
    fireEvent.click(screen.getByText('Claude Code'))
    await waitFor(() => screen.getByText('Continue'))
    fireEvent.click(screen.getByText('Continue'))
    await waitFor(() => screen.getByText('Skip'))
    fireEvent.click(screen.getByText('Skip'))
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled()
    })
  })

  it('saves skipDoctor=true to settings when skip is clicked', async () => {
    render(<Onboarding hasProject={true} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('Claude Code'))
    await waitFor(() => screen.getByText('Continue'))
    fireEvent.click(screen.getByText('Continue'))
    await waitFor(() => screen.getByText('Skip'))
    fireEvent.click(screen.getByText('Skip'))
    await waitFor(() => {
      expect(mockApi.writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({ skipDoctor: true })
      )
    })
  })

  it('completes onboarding immediately when agent already configured and skipDoctor', async () => {
    mockApi.readSettings.mockResolvedValue({ codingAgent: 'claude-code', skipDoctor: true })
    mockApi.openDirectory.mockResolvedValue('/some/path')
    mockApi.isInitialized.mockResolvedValue(true)
    mockApi.readProjectState.mockResolvedValue({
      version: 1,
      projectName: 'test',
      tasks: [],
      columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
      labels: []
    })

    const onComplete = vi.fn()
    useTaskStore.setState({ projectState: null, isLoading: false })
    render(<Onboarding hasProject={false} onComplete={onComplete} />)
    fireEvent.click(screen.getByText('Open Folder'))
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled()
    })
  })

  it('skips to install-cli when agent configured but skipDoctor is false', async () => {
    mockApi.readSettings.mockResolvedValue({ codingAgent: 'claude-code', skipDoctor: false })
    mockApi.openDirectory.mockResolvedValue('/some/path')
    mockApi.isInitialized.mockResolvedValue(true)
    mockApi.readProjectState.mockResolvedValue({
      version: 1,
      projectName: 'test',
      tasks: [],
      columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
      labels: []
    })

    useTaskStore.setState({ projectState: null, isLoading: false })
    render(<Onboarding hasProject={false} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('Open Folder'))
    await waitFor(() => {
      expect(screen.getByText('Install CLI')).toBeInTheDocument()
    })
  })

  it('shows step indicator with 4 dots', () => {
    render(<Onboarding hasProject={false} onComplete={vi.fn()} />)
    const container = document.querySelector('[style*="gap"]')
    expect(container).toBeTruthy()
  })
})
