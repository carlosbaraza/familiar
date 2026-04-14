import { useState, useEffect, useCallback, useRef } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'
import type { ProjectSettings, AgentProfile } from '@shared/types'
import type { CodeEditor, AgentType } from '@shared/types/settings'
import {
  DEFAULT_SETTINGS,
  DEFAULT_SNIPPETS,
  CODE_EDITOR_LABELS,
  AGENT_TYPE_LABELS,
  AGENT_TYPE_DEFAULT_COMMANDS,
  AGENT_TYPE_DEFAULT_SNIPPETS,
  AGENT_TYPE_ICONS
} from '@shared/types/settings'
import { DEFAULT_LABELS } from '@shared/constants'
import { generateAgentId } from '@shared/utils/id-generator'
import { AgentIcon } from '@renderer/components/common/AgentIcons'
import { SnippetSettings } from './SnippetSettings'
import { LabelSettings } from './LabelSettings'
import { WorkspacesSettings } from './WorkspacesSettings'
import { AppearanceSettings } from './AppearanceSettings'

const AUTOSAVE_DELAY_MS = 500

export function SettingsPage(): React.JSX.Element {
  const closeSettings = useUIStore((s) => s.closeSettings)
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS)
  const isLoaded = useRef(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load settings on mount
  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const s = await window.api.readSettings()
        setSettings(s)
      } catch {
        // Use defaults
      }
      isLoaded.current = true
    }
    load()
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [])

  const saveSettings = useCallback(async (current: ProjectSettings) => {
    try {
      const toSave = { ...current }
      if (toSave.snippets) {
        toSave.snippets = toSave.snippets.filter((s) => s.title.trim() && s.command.trim())
      }
      if (toSave.labels) {
        toSave.labels = toSave.labels.filter((l) => l.name.trim())
      }
      await window.api.writeSettings(toSave)
      window.dispatchEvent(
        new CustomEvent('snippets-updated', {
          detail: toSave.snippets ?? DEFAULT_SNIPPETS
        })
      )
      window.dispatchEvent(
        new CustomEvent('labels-updated', {
          detail: toSave.labels ?? DEFAULT_LABELS
        })
      )
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }, [])

  const handleChange = useCallback(
    <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value }
        // Debounced autosave
        if (isLoaded.current) {
          if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
          autosaveTimer.current = setTimeout(() => saveSettings(next), AUTOSAVE_DELAY_MS)
        }
        return next
      })
    },
    [saveSettings]
  )

  const [addingAgent, setAddingAgent] = useState(false)
  const [newAgentType, setNewAgentType] = useState<AgentType>('claude-code')
  const [newAgentName, setNewAgentName] = useState(AGENT_TYPE_LABELS['claude-code'])
  const [newAgentCommand, setNewAgentCommand] = useState(
    AGENT_TYPE_DEFAULT_COMMANDS['claude-code']
  )
  const [newAgentIcon, setNewAgentIcon] = useState(AGENT_TYPE_ICONS['claude-code'])

  const dispatchAgentsUpdated = useCallback(
    (agents: AgentProfile[], activeAgentId?: string) => {
      window.dispatchEvent(
        new CustomEvent('agents-updated', { detail: { agents, activeAgentId } })
      )
    },
    []
  )

  const handleAddAgent = useCallback(() => {
    const type = newAgentType
    const profile: AgentProfile = {
      id: generateAgentId(),
      type,
      name: newAgentName || AGENT_TYPE_LABELS[type],
      icon: type === 'other' ? newAgentIcon || 'terminal' : AGENT_TYPE_ICONS[type],
      defaultCommand: newAgentCommand || AGENT_TYPE_DEFAULT_COMMANDS[type],
      snippets: AGENT_TYPE_DEFAULT_SNIPPETS[type] ?? []
    }
    const agents = [...(settings.agents ?? []), profile]
    const activeAgentId = settings.activeAgentId ?? profile.id
    handleChange('agents', agents)
    if (!settings.activeAgentId) {
      handleChange('activeAgentId', activeAgentId)
    }
    dispatchAgentsUpdated(agents, activeAgentId)
    setAddingAgent(false)
    // Reset form to defaults
    setNewAgentType('claude-code')
    setNewAgentName(AGENT_TYPE_LABELS['claude-code'])
    setNewAgentCommand(AGENT_TYPE_DEFAULT_COMMANDS['claude-code'])
    setNewAgentIcon(AGENT_TYPE_ICONS['claude-code'])
  }, [
    settings,
    newAgentType,
    newAgentName,
    newAgentCommand,
    newAgentIcon,
    handleChange,
    dispatchAgentsUpdated
  ])

  const handleDeleteAgent = useCallback(
    (agentId: string) => {
      const agents = (settings.agents ?? []).filter((a) => a.id !== agentId)
      handleChange('agents', agents)
      let newActiveId = settings.activeAgentId
      if (settings.activeAgentId === agentId) {
        newActiveId = agents.length > 0 ? agents[0].id : undefined
        handleChange('activeAgentId', newActiveId)
      }
      dispatchAgentsUpdated(agents, newActiveId)
    },
    [settings, handleChange, dispatchAgentsUpdated]
  )

  const handleSetActiveAgent = useCallback(
    (agentId: string) => {
      handleChange('activeAgentId', agentId)
      dispatchAgentsUpdated(settings.agents ?? [], agentId)
    },
    [settings, handleChange, dispatchAgentsUpdated]
  )

  const handleNewAgentTypeChange = useCallback((type: AgentType) => {
    setNewAgentType(type)
    setNewAgentName(AGENT_TYPE_LABELS[type])
    setNewAgentCommand(AGENT_TYPE_DEFAULT_COMMANDS[type])
    setNewAgentIcon(AGENT_TYPE_ICONS[type])
  }, [])

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>Settings</h1>
          <button style={styles.closeButton} onClick={closeSettings} title="Close (Escape)">
            &times;
          </button>
        </div>

        <div style={styles.body}>
          {/* Appearance section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Appearance</h2>
            <AppearanceSettings />
          </div>

          {/* Terminal section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Terminal</h2>

            <div style={styles.settingRow}>
              <div style={styles.settingInfo}>
                <label style={styles.settingLabel}>Default Command</label>
                <span style={styles.settingDescription}>
                  Command to run automatically when a new task terminal is created
                </span>
              </div>
              <input
                style={styles.textInput}
                type="text"
                value={settings.defaultCommand ?? ''}
                onChange={(e) => handleChange('defaultCommand', e.target.value || undefined)}
                placeholder="e.g. claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions"
              />
            </div>
          </div>

          {/* Agent section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Agent</h2>

            <div style={styles.settingRow}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={styles.settingInfo}>
                  <label style={styles.settingLabel}>Simplify Task Titles</label>
                  <span style={styles.settingDescription}>
                    Agents will shorten verbose task titles and move the original prompt to the task
                    notes
                  </span>
                </div>
                <button
                  style={{
                    ...styles.toggleButton,
                    ...(settings.simplifyTaskTitles ? styles.toggleButtonActive : {})
                  }}
                  onClick={() => handleChange('simplifyTaskTitles', !settings.simplifyTaskTitles)}
                  role="switch"
                  aria-checked={settings.simplifyTaskTitles ?? false}
                >
                  <span
                    style={{
                      ...styles.toggleKnob,
                      ...(settings.simplifyTaskTitles ? styles.toggleKnobActive : {})
                    }}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Coding Agents section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Coding Agents</h2>

            {(settings.agents ?? []).map((agent) => (
              <div
                key={agent.id}
                style={{
                  border:
                    agent.id === settings.activeAgentId
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  marginBottom: 'var(--space-2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}
              >
                <AgentIcon agentType={agent.type} size={20} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...styles.settingLabel, marginBottom: 2 }}>{agent.name}</div>
                  <div
                    style={{
                      ...styles.settingDescription,
                      fontSize: 11,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {agent.defaultCommand || 'No command configured'}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-1)',
                    alignItems: 'center',
                    flexShrink: 0
                  }}
                >
                  {agent.id === settings.activeAgentId ? (
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--accent)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      Active
                    </span>
                  ) : (
                    <button
                      style={{ ...styles.actionButton, fontSize: 11, padding: '2px 8px' }}
                      onClick={() => handleSetActiveAgent(agent.id)}
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    style={{
                      ...styles.actionButton,
                      fontSize: 11,
                      padding: '2px 8px',
                      color: 'var(--priority-urgent)'
                    }}
                    onClick={() => handleDeleteAgent(agent.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {addingAgent ? (
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)'
                }}
              >
                <div>
                  <label
                    style={{
                      ...styles.settingLabel,
                      fontSize: 11,
                      marginBottom: 4,
                      display: 'block'
                    }}
                  >
                    Agent Type
                  </label>
                  <select
                    style={styles.textInput}
                    value={newAgentType}
                    onChange={(e) => handleNewAgentTypeChange(e.target.value as AgentType)}
                  >
                    {(Object.keys(AGENT_TYPE_LABELS) as AgentType[]).map((key) => (
                      <option key={key} value={key}>
                        {AGENT_TYPE_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      ...styles.settingLabel,
                      fontSize: 11,
                      marginBottom: 4,
                      display: 'block'
                    }}
                  >
                    Name
                  </label>
                  <input
                    style={styles.textInput}
                    type="text"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder={AGENT_TYPE_LABELS[newAgentType]}
                  />
                </div>
                <div>
                  <label
                    style={{
                      ...styles.settingLabel,
                      fontSize: 11,
                      marginBottom: 4,
                      display: 'block'
                    }}
                  >
                    Default Command
                  </label>
                  <input
                    style={styles.textInput}
                    type="text"
                    value={newAgentCommand}
                    onChange={(e) => setNewAgentCommand(e.target.value)}
                    placeholder={AGENT_TYPE_DEFAULT_COMMANDS[newAgentType]}
                  />
                </div>
                {newAgentType === 'other' && (
                  <div>
                    <label
                      style={{
                        ...styles.settingLabel,
                        fontSize: 11,
                        marginBottom: 4,
                        display: 'block'
                      }}
                    >
                      Icon (Lucide name)
                    </label>
                    <input
                      style={styles.textInput}
                      type="text"
                      value={newAgentIcon}
                      onChange={(e) => setNewAgentIcon(e.target.value)}
                      placeholder="terminal"
                    />
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    justifyContent: 'flex-end'
                  }}
                >
                  <button
                    style={{ ...styles.actionButton, fontSize: 11, padding: '4px 12px' }}
                    onClick={() => setAddingAgent(false)}
                  >
                    Cancel
                  </button>
                  <button
                    style={{
                      ...styles.actionButton,
                      fontSize: 11,
                      padding: '4px 12px',
                      backgroundColor: 'var(--accent)',
                      color: 'white',
                      borderColor: 'var(--accent)'
                    }}
                    onClick={handleAddAgent}
                  >
                    Add Agent
                  </button>
                </div>
              </div>
            ) : (
              <button
                style={{
                  ...styles.actionButton,
                  fontSize: 12,
                  padding: '6px 12px',
                  width: '100%'
                }}
                onClick={() => setAddingAgent(true)}
              >
                + Add Agent
              </button>
            )}
          </div>

          {/* Code Editor section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Code Editor</h2>

            <div style={styles.settingRow}>
              <div style={styles.settingInfo}>
                <label style={styles.settingLabel}>Default Code Editor</label>
                <span style={styles.settingDescription}>
                  Editor used when opening the project folder from the navbar
                </span>
              </div>
              <select
                style={styles.textInput}
                value={settings.codeEditor ?? 'system'}
                onChange={(e) =>
                  handleChange(
                    'codeEditor',
                    (e.target.value as CodeEditor) || undefined
                  )
                }
              >
                {(Object.keys(CODE_EDITOR_LABELS) as CodeEditor[]).map((key) => (
                  <option key={key} value={key}>
                    {CODE_EDITOR_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            {settings.codeEditor === 'custom' && (
              <div style={styles.settingRow}>
                <div style={styles.settingInfo}>
                  <label style={styles.settingLabel}>Custom Command</label>
                  <span style={styles.settingDescription}>
                    Shell command to open a folder (the project path is appended as an argument)
                  </span>
                </div>
                <input
                  style={styles.textInput}
                  type="text"
                  value={settings.codeEditorCustomCommand ?? ''}
                  onChange={(e) => handleChange('codeEditorCustomCommand', e.target.value || undefined)}
                  placeholder="e.g. code, cursor, zed, nvim"
                />
              </div>
            )}
          </div>

          {/* Labels section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Labels</h2>
            <p style={styles.settingDescription}>
              Labels available for categorizing tasks across the project
            </p>
            <LabelSettings
              labels={settings.labels ?? DEFAULT_LABELS}
              onChange={(labels) => handleChange('labels', labels)}
            />
          </div>

          {/* Snippets section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Snippets</h2>
            <p style={styles.settingDescription}>
              Terminal command shortcuts shown as buttons above the terminal
            </p>
            <SnippetSettings
              snippets={settings.snippets ?? DEFAULT_SNIPPETS}
              onChange={(snippets) => handleChange('snippets', snippets)}
            />
          </div>

          {/* Workspaces section */}
          <WorkspacesSettings />
        </div>

      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties & Record<string, unknown>> = {
  container: {
    position: 'fixed',
    inset: 0,
    top: 40, // Below navbar
    backgroundColor: 'var(--bg-primary)',
    zIndex: 300,
    display: 'flex',
    justifyContent: 'center',
    overflowY: 'auto',
    WebkitAppRegion: 'no-drag'
  },
  content: {
    width: '100%',
    maxWidth: 960,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    padding: '0 16px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px 0 16px',
    borderBottom: '1px solid var(--border)'
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    margin: 0
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '22px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1
  },
  body: {
    flex: 1,
    padding: '16px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px'
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    margin: 0
  },
  settingRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  settingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  settingLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  settingDescription: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    margin: 0
  },
  textInput: {
    padding: '8px 12px',
    fontSize: '13px',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const
  },
  toggleButton: {
    width: 40,
    height: 22,
    borderRadius: 11,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    cursor: 'pointer',
    position: 'relative' as const,
    padding: 0,
    flexShrink: 0,
    transition: 'background-color 0.15s ease'
  },
  toggleButtonActive: {
    backgroundColor: 'var(--accent-subtle)',
    borderColor: 'var(--accent)'
  },
  toggleKnob: {
    display: 'block',
    width: 16,
    height: 16,
    borderRadius: '50%',
    backgroundColor: 'var(--text-tertiary)',
    position: 'absolute' as const,
    top: 2,
    left: 2,
    transition: 'transform 0.15s ease, background-color 0.15s ease'
  },
  toggleKnobActive: {
    transform: 'translateX(18px)',
    backgroundColor: 'var(--accent)'
  },
  actionButton: {
    padding: '4px 10px',
    fontSize: '12px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    outline: 'none'
  },
}
