import { useState, useCallback, useEffect } from 'react'
import type { CodingAgent, ProjectSettings } from '@shared/types'
import { CODING_AGENT_LABELS } from '@shared/types/settings'
import { DOCTOR_PROMPT } from '@shared/prompts'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'

type OnboardingStep = 'open-folder' | 'select-agent' | 'install-cli' | 'doctor'

interface OnboardingProps {
  /** Whether a project is already loaded (folder already open) */
  hasProject: boolean
  /** Called when the full onboarding is complete */
  onComplete: () => void
}

export function Onboarding({ hasProject, onComplete }: OnboardingProps): React.JSX.Element {
  const [step, setStep] = useState<OnboardingStep>(hasProject ? 'select-agent' : 'open-folder')
  const [skipDoctor, setSkipDoctor] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<CodingAgent | null>(null)
  const [copied, setCopied] = useState(false)
  const openWorkspace = useTaskStore((s) => s.openWorkspace)

  // CLI install state
  const [cliAvailable, setCliAvailable] = useState<boolean | null>(null)
  const [cliInstalling, setCliInstalling] = useState(false)
  const [cliInstallResult, setCliInstallResult] = useState<{
    success: boolean
    shell: string
    error?: string
  } | null>(null)

  // Check CLI availability when entering the install-cli step
  useEffect(() => {
    if (step === 'install-cli' && cliAvailable === null) {
      window.api
        .cliCheckAvailable()
        .then((available) => setCliAvailable(available))
        .catch(() => setCliAvailable(false))
    }
  }, [step, cliAvailable])

  const handleOpenFolder = useCallback(async () => {
    const success = await openWorkspace()
    if (!success) return

    // Check if agent is already configured
    try {
      const settings = await window.api.readSettings()
      if (settings.codingAgent) {
        if (settings.skipDoctor || skipDoctor) {
          onComplete()
        } else {
          setSelectedAgent(settings.codingAgent)
          setStep('install-cli')
        }
        return
      }
    } catch {
      // Settings not available yet — continue onboarding
    }

    setStep('select-agent')
  }, [openWorkspace, skipDoctor, onComplete])

  const handleSelectAgent = useCallback(
    async (agent: CodingAgent) => {
      setSelectedAgent(agent)

      // Save agent choice to settings
      try {
        const settings = await window.api.readSettings()
        const updated: ProjectSettings = { ...settings, codingAgent: agent, skipDoctor }
        await window.api.writeSettings(updated)
      } catch {
        // Will be saved later
      }

      if (skipDoctor) {
        // Still show install-cli — it's quick and important
        setStep('install-cli')
      } else {
        setStep('install-cli')
      }
    },
    [skipDoctor]
  )

  const handleInstallCli = useCallback(async () => {
    setCliInstalling(true)
    try {
      const result = await window.api.cliInstallToPath()
      setCliInstallResult(result)
      if (result.success) {
        setCliAvailable(true)
      }
    } catch {
      setCliInstallResult({ success: false, shell: '', error: 'Installation failed' })
    }
    setCliInstalling(false)
  }, [])

  const handleCliContinue = useCallback(() => {
    if (skipDoctor) {
      onComplete()
    } else {
      setStep('doctor')
    }
  }, [skipDoctor, onComplete])

  const handleCopyDoctor = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(DOCTOR_PROMPT)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may fail
    }
  }, [])

  const handleRunDoctor = useCallback(async () => {
    try {
      const settings = await window.api.readSettings()
      const updated: ProjectSettings = { ...settings, skipDoctor }
      await window.api.writeSettings(updated)
    } catch {
      // ignore
    }

    const { addTask } = useTaskStore.getState()
    const task = await addTask('Doctor Check', { status: 'in-progress', labels: ['chore'] })
    await window.api.writeTaskDocument(task.id, DOCTOR_PROMPT)

    window.api.warmupTmuxSession(task.id).catch(() => {})

    onComplete()
    setTimeout(() => {
      useUIStore.getState().openTaskDetail(task.id)

      const sessionName = `familiar-${task.id}`
      setTimeout(async () => {
        if (selectedAgent === 'claude-code') {
          try {
            await window.api.tmuxSendKeys(
              sessionName,
              'familiar doctor --copy | claude --print',
              true
            )
          } catch {
            // Terminal may not be ready yet
          }
        }
      }, 3000)
    }, 100)
  }, [selectedAgent, skipDoctor, onComplete])

  const handleSkipDoctor = useCallback(async () => {
    try {
      const settings = await window.api.readSettings()
      const updated: ProjectSettings = { ...settings, skipDoctor: true }
      await window.api.writeSettings(updated)
    } catch {
      // ignore
    }
    onComplete()
  }, [onComplete])

  // ── Step 1: Open Folder ──
  if (step === 'open-folder') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <StepIndicator current={0} total={4} />

          <div style={styles.iconContainer}>
            <FolderIcon size={56} />
          </div>

          <h1 style={styles.title}>Welcome to Familiar</h1>
          <p style={styles.subtitle}>
            Open a project folder to get started. If the folder already has a Familiar project, it
            will be loaded automatically.
          </p>

          <button style={styles.primaryButton} onClick={handleOpenFolder}>
            <FolderIcon size={16} />
            Open Folder
          </button>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={skipDoctor}
              onChange={(e) => setSkipDoctor(e.target.checked)}
              style={styles.checkbox}
            />
            <span style={styles.checkboxText}>Skip environment check on setup</span>
          </label>
        </div>
      </div>
    )
  }

  // ── Step 2: Select Agent ──
  if (step === 'select-agent') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <StepIndicator current={1} total={4} />

          <div style={styles.iconContainer}>
            <TerminalIcon size={56} />
          </div>

          <h1 style={styles.title}>Select Your Coding Agent</h1>
          <p style={styles.subtitle}>
            Choose which AI coding agent you use. This configures how Familiar interacts with your
            agent.
          </p>

          <div style={styles.agentGrid}>
            <button style={styles.agentCard} onClick={() => handleSelectAgent('claude-code')}>
              <div style={styles.agentIcon}>
                <TerminalIcon size={32} />
              </div>
              <span style={styles.agentName}>{CODING_AGENT_LABELS['claude-code']}</span>
              <span style={styles.agentBadge}>Recommended</span>
            </button>

            <button style={styles.agentCard} onClick={() => handleSelectAgent('other')}>
              <div style={styles.agentIcon}>
                <QuestionIcon size={32} />
              </div>
              <span style={styles.agentName}>Other</span>
              <span style={styles.agentDescription}>Not fully tested</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3: Install CLI ──
  if (step === 'install-cli') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <StepIndicator current={2} total={4} />

          <div style={styles.iconContainer}>
            <TerminalPromptIcon size={56} />
          </div>

          <h1 style={styles.title}>Install CLI</h1>
          <p style={styles.subtitle}>
            The <code style={styles.inlineCode}>familiar</code> CLI lets you manage tasks from your
            terminal and is required for agent integration.
          </p>

          {cliAvailable === null && (
            <div style={styles.cliStatus}>
              <span style={styles.cliStatusText}>Checking CLI availability...</span>
            </div>
          )}

          {cliAvailable === true && !cliInstallResult && (
            <div style={styles.cliStatusSuccess}>
              <CheckIcon />
              <span style={styles.cliStatusText}>
                CLI is already installed and in your PATH
              </span>
            </div>
          )}

          {cliAvailable === false && !cliInstallResult && (
            <>
              <div style={styles.cliStatusWarn}>
                <span style={styles.cliStatusText}>CLI not found in PATH</span>
              </div>

              <button
                style={{
                  ...styles.primaryButton,
                  ...(cliInstalling ? { opacity: 0.6, cursor: 'default' } : {})
                }}
                onClick={handleInstallCli}
                disabled={cliInstalling}
              >
                <DownloadIcon size={16} />
                {cliInstalling ? 'Installing...' : 'Install CLI to PATH'}
              </button>
            </>
          )}

          {cliInstallResult?.success && (
            <div style={styles.cliStatusSuccess}>
              <CheckIcon />
              <div>
                <span style={styles.cliStatusText}>CLI installed successfully</span>
                <span style={styles.cliHint}>
                  Restart your {cliInstallResult.shell} terminal or run{' '}
                  <code style={styles.inlineCode}>
                    source ~/.{cliInstallResult.shell}rc
                  </code>
                </span>
              </div>
            </div>
          )}

          {cliInstallResult && !cliInstallResult.success && (
            <div style={styles.cliStatusError}>
              <span style={styles.cliStatusText}>
                Install failed: {cliInstallResult.error}
              </span>
            </div>
          )}

          <div style={styles.cliManualSection}>
            <details style={styles.details}>
              <summary style={styles.detailsSummary}>Manual installation instructions</summary>
              <div style={styles.detailsContent}>
                <p style={styles.manualText}>
                  The CLI binary is bundled inside Familiar.app. The Install button creates a symlink
                  at <code style={styles.inlineCode}>~/.familiar/bin/familiar</code> and adds it to
                  your shell PATH.
                </p>
                <p style={styles.manualText}>To set it up manually:</p>
                <pre style={styles.manualCode}>{MANUAL_CLI_INSTALL}</pre>
              </div>
            </details>
          </div>

          <div style={styles.doctorActions}>
            <button style={styles.primaryButton} onClick={handleCliContinue}>
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 4: Doctor Check ──
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <StepIndicator current={3} total={4} />

        <div style={styles.iconContainer}>
          <HeartPulseIcon size={56} />
        </div>

        <h1 style={styles.title}>Environment Check</h1>
        <p style={styles.subtitle}>
          Run the doctor command to verify your environment is properly configured for{' '}
          {selectedAgent ? CODING_AGENT_LABELS[selectedAgent] : 'your agent'}.
        </p>

        <div style={styles.doctorPreview}>
          <div style={styles.doctorHeader}>
            <span style={styles.doctorLabel}>Doctor Prompt</span>
            <button style={styles.copyButton} onClick={handleCopyDoctor}>
              {copied ? (
                <>
                  <CheckIcon />
                  Copied
                </>
              ) : (
                <>
                  <CopyIcon />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre style={styles.doctorCode}>{DOCTOR_PROMPT}</pre>
        </div>

        <div style={styles.doctorActions}>
          <button style={styles.primaryButton} onClick={handleRunDoctor}>
            <PlayIcon size={16} />
            Run Doctor
          </button>
          <button style={styles.secondaryButton} onClick={handleSkipDoctor}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Icon components ──

function FolderIcon({ size }: { size: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size > 20 ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function TerminalIcon({ size }: { size: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size > 20 ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17l6-6-6-6" />
      <path d="M12 19h8" />
    </svg>
  )
}

function TerminalPromptIcon({ size }: { size: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size > 20 ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function QuestionIcon({ size }: { size: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size > 20 ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function HeartPulseIcon({ size }: { size: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size > 20 ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

function PlayIcon({ size }: { size: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function DownloadIcon({ size }: { size: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function CheckIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function CopyIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

// ── Step indicator ──

function StepIndicator({ current, total }: { current: number; total: number }): React.JSX.Element {
  const items: React.JSX.Element[] = []
  for (let i = 0; i < total; i++) {
    if (i > 0) {
      items.push(<StepLine key={`line-${i}`} completed={i <= current} />)
    }
    items.push(
      <StepDot key={`dot-${i}`} active={i === current} completed={i < current} />
    )
  }
  return <div style={styles.stepIndicator}>{items}</div>
}

function StepDot({
  active,
  completed
}: {
  active?: boolean
  completed?: boolean
}): React.JSX.Element {
  const dotStyle: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: completed || active ? 'var(--accent)' : 'var(--bg-elevated)',
    border: active ? '2px solid var(--accent)' : completed ? 'none' : '2px solid var(--border)',
    boxShadow: active ? '0 0 0 3px var(--accent-subtle)' : 'none',
    transition: 'all 0.2s ease'
  }
  return <div style={dotStyle} />
}

function StepLine({ completed }: { completed?: boolean }): React.JSX.Element {
  return (
    <div
      style={{
        width: 32,
        height: 2,
        backgroundColor: completed ? 'var(--accent)' : 'var(--border)',
        transition: 'background-color 0.2s ease'
      }}
    />
  )
}

// ── Constants ──

const MANUAL_CLI_INSTALL = `# 1. Create the bin directory
mkdir -p ~/.familiar/bin

# 2. Symlink the CLI from the app bundle
ln -sf "/Applications/Familiar.app/Contents/Resources/bin/index.mjs" \\
       ~/.familiar/bin/familiar

# 3. Add to PATH (zsh — for bash, use ~/.bashrc)
echo '
# Added by Familiar — CLI path
export PATH="$HOME/.familiar/bin:$PATH"' >> ~/.zshrc

# 4. Reload your shell
source ~/.zshrc`

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '24px',
    backgroundColor: 'var(--bg-primary)'
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: 520,
    width: '100%',
    padding: '40px 32px',
    gap: '20px'
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    marginBottom: '8px'
  },
  iconContainer: {
    color: 'var(--accent)',
    marginBottom: '4px'
  },
  title: {
    fontSize: '22px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    margin: 0,
    textAlign: 'center' as const
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    textAlign: 'center' as const,
    lineHeight: 1.6,
    maxWidth: 380,
    margin: 0
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    height: '40px',
    padding: '8px 24px',
    backgroundColor: 'var(--accent)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
    marginTop: '4px'
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    height: '40px',
    padding: '8px 24px',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    cursor: 'pointer',
    transition: 'all 150ms ease'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    marginTop: '4px'
  },
  checkbox: {
    accentColor: 'var(--accent)',
    width: '14px',
    height: '14px',
    cursor: 'pointer',
    margin: 0,
    border: 'none',
    padding: 0
  },
  checkboxText: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  agentGrid: {
    display: 'flex',
    gap: '12px',
    width: '100%',
    marginTop: '4px'
  },
  agentCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    padding: '20px 16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    color: 'var(--text-primary)'
  },
  agentIcon: {
    color: 'var(--text-secondary)',
    marginBottom: '4px'
  },
  agentName: {
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  agentBadge: {
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--accent)',
    backgroundColor: 'var(--accent-subtle)',
    padding: '2px 8px',
    borderRadius: '10px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  agentDescription: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  inlineCode: {
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: '12px',
    backgroundColor: 'var(--bg-elevated)',
    padding: '1px 5px',
    borderRadius: '3px',
    color: 'var(--text-secondary)'
  },
  cliStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    width: '100%'
  },
  cliStatusSuccess: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '6px',
    backgroundColor: 'rgba(39, 174, 96, 0.08)',
    border: '1px solid rgba(39, 174, 96, 0.25)',
    width: '100%',
    color: '#27ae60'
  },
  cliStatusWarn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '6px',
    backgroundColor: 'rgba(232, 155, 62, 0.08)',
    border: '1px solid rgba(232, 155, 62, 0.25)',
    width: '100%',
    color: '#e89b3e'
  },
  cliStatusError: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '6px',
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    border: '1px solid rgba(231, 76, 60, 0.25)',
    width: '100%',
    color: '#e74c3c'
  },
  cliStatusText: {
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  cliHint: {
    display: 'block',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    marginTop: '4px',
    fontWeight: 400
  },
  cliManualSection: {
    width: '100%'
  },
  details: {
    width: '100%'
  },
  detailsSummary: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    padding: '4px 0',
    userSelect: 'none' as const
  },
  detailsContent: {
    marginTop: '8px'
  },
  manualText: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    lineHeight: 1.6,
    margin: '0 0 8px 0',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  manualCode: {
    padding: '10px 12px',
    fontSize: '11px',
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    margin: 0,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    overflowX: 'auto' as const
  },
  doctorPreview: {
    width: '100%',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  doctorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg-elevated)'
  },
  doctorLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  copyButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    transition: 'all 100ms ease'
  },
  doctorCode: {
    padding: '12px',
    fontSize: '11px',
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    margin: 0,
    maxHeight: '200px',
    overflowY: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const
  },
  doctorActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px'
  }
}
