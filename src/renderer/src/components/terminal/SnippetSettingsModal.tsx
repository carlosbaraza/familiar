import { useState, useCallback } from 'react'
import type { Snippet, ProjectSettings } from '@shared/types'

interface SnippetSettingsModalProps {
  snippets: Snippet[]
  onSave: (snippets: Snippet[]) => void
  onClose: () => void
}

export function SnippetSettingsModal({
  snippets: initialSnippets,
  onSave,
  onClose
}: SnippetSettingsModalProps): React.JSX.Element {
  const [snippets, setSnippets] = useState<Snippet[]>(
    initialSnippets.map((s) => ({ ...s }))
  )

  const handleChange = useCallback(
    (index: number, field: keyof Snippet, value: string | boolean) => {
      setSnippets((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], [field]: value }
        return next
      })
    },
    []
  )

  const handleAdd = useCallback(() => {
    setSnippets((prev) => [...prev, { title: '', command: '', pressEnter: true }])
  }, [])

  const handleRemove = useCallback((index: number) => {
    setSnippets((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSave = useCallback(async () => {
    // Filter out empty snippets
    const valid = snippets.filter((s) => s.title.trim() && s.command.trim())
    try {
      const settings: ProjectSettings = await window.api.readSettings()
      settings.snippets = valid
      await window.api.writeSettings(settings)
      onSave(valid)
    } catch (err) {
      console.error('Failed to save snippet settings:', err)
    }
  }, [snippets, onSave])

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Snippet Settings</span>
          <button style={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={styles.body}>
          {snippets.map((snippet, i) => (
            <div key={i} style={styles.row}>
              <input
                style={styles.input}
                placeholder="Label"
                value={snippet.title}
                onChange={(e) => handleChange(i, 'title', e.target.value)}
              />
              <input
                style={{ ...styles.input, flex: 2 }}
                placeholder="Command"
                value={snippet.command}
                onChange={(e) => handleChange(i, 'command', e.target.value)}
              />
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={snippet.pressEnter}
                  onChange={(e) => handleChange(i, 'pressEnter', e.target.checked)}
                />
                <span style={styles.checkboxText}>Enter</span>
              </label>
              <button style={styles.removeButton} onClick={() => handleRemove(i)} title="Remove">
                &times;
              </button>
            </div>
          ))}

          <button style={styles.addButton} onClick={handleAdd}>
            + Add Snippet
          </button>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button style={styles.saveButton} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  modal: {
    width: '520px',
    maxHeight: '80vh',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)'
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1
  },
  body: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
    flex: 1
  },
  row: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    padding: '6px 10px',
    fontSize: '12px',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    borderRadius: '5px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    flexShrink: 0
  },
  checkboxText: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  removeButton: {
    background: 'none',
    border: 'none',
    color: '#e74c3c',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    flexShrink: 0
  },
  addButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '5px',
    border: '1px dashed var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    alignSelf: 'flex-start'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid var(--border)'
  },
  cancelButton: {
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '5px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    cursor: 'pointer'
  },
  saveButton: {
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '5px',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#818cf8',
    cursor: 'pointer'
  }
}
