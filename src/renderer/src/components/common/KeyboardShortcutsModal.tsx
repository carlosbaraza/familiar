import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'

interface ShortcutItem {
  keys: string[]
  description: string
  detail?: string
}

interface ShortcutGroup {
  title: string
  shortcuts: ShortcutItem[]
}

interface WorkflowStep {
  keys: string[]
  text: string
}

interface Workflow {
  title: string
  description: string
  steps: WorkflowStep[]
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['⌘', 'F'], description: 'Search' },
      { keys: ['⌘', 'N'], description: 'Create new task' },
      { keys: ['⌘', ','], description: 'Open settings' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close current panel', detail: 'Layered dismiss: closes the topmost panel (shortcuts modal, command palette, settings, or task detail). In task detail view, first clears selection, then closes the view.' },
      { keys: ['⇧', 'Esc'], description: 'Force close (works in terminals)', detail: 'When the terminal has focus, plain Escape is captured by the terminal. Use Shift+Escape to close the task detail view from within a terminal session.' }
    ]
  },
  {
    title: 'Board Navigation',
    shortcuts: [
      { keys: ['j', '↓'], description: 'Move down in column' },
      { keys: ['k', '↑'], description: 'Move up in column' },
      { keys: ['h', '←'], description: 'Move to previous column' },
      { keys: ['l', '→'], description: 'Move to next column' },
      { keys: ['⇧', '↑'], description: 'Select previous card', detail: 'Extends multi-selection upward. Hold Shift and press Up to select multiple cards. Use with status chords (s+1-5) to bulk-move tasks.' },
      { keys: ['⇧', '↓'], description: 'Select next card', detail: 'Extends multi-selection downward. Selected cards are highlighted with an accent border.' },
      { keys: ['⌥', '↑'], description: 'Move card up', detail: 'Reorders the focused card one position up within the same column. The sort order is persisted automatically.' },
      { keys: ['⌥', '↓'], description: 'Move card down' },
      { keys: ['Enter'], description: 'Open selected task', detail: 'Opens the task detail view. The terminal panel is visible but not auto-focused — use Cmd+Enter to focus it.' },
      { keys: ['Space'], description: 'Open task & edit title', detail: 'Opens the task detail view and immediately focuses the title for editing. Press Enter to move to the notes editor. This is the fastest way to review and edit a task\'s details.' },
      { keys: ['c'], description: 'Create task in focused column' }
    ]
  },
  {
    title: 'Task Detail Navigation',
    shortcuts: [
      { keys: ['Space'], description: 'Open task & focus title', detail: 'From the board, opens the selected task and places the cursor in the title field for quick editing.' },
      { keys: ['Enter'], description: 'Title → Notes', detail: 'When the title is focused, pressing Enter saves the title and moves the cursor to the notes editor for seamless content editing.' },
      { keys: ['↑'], description: 'Notes → Title', detail: 'When the cursor is at the very top of the notes editor (beginning of first line), pressing Up moves focus back to the title. This creates a seamless editing loop between title and notes.' },
      { keys: ['⌘', '↵'], description: 'Focus terminal', detail: 'From anywhere in the task detail view (title, notes, or any other element), press Cmd+Enter to immediately focus the terminal. Useful for switching between editing and running commands.' },
      { keys: ['Esc'], description: 'Close task detail' },
      { keys: ['⇧', 'Esc'], description: 'Close from terminal', detail: 'Use when the terminal has focus and plain Escape is being consumed by the running process (e.g., vim, tmux).' }
    ]
  },
  {
    title: 'Task Actions',
    shortcuts: [
      { keys: ['1'], description: 'Set priority: Urgent' },
      { keys: ['2'], description: 'Set priority: High' },
      { keys: ['3'], description: 'Set priority: Medium' },
      { keys: ['4'], description: 'Set priority: Low' },
      { keys: ['s'], description: 'Move task to status (then press 1–5)', detail: 'Press s to start a status chord, then a number within 1.5 seconds: 1=Todo, 2=In Progress, 3=In Review, 4=Done, 5=Archived. Works with multi-selection.' },
      { keys: ['s', '1'], description: 'Move to Todo' },
      { keys: ['s', '2'], description: 'Move to In Progress' },
      { keys: ['s', '3'], description: 'Move to In Review' },
      { keys: ['s', '4'], description: 'Move to Done' },
      { keys: ['s', '5'], description: 'Move to Archived' },
      { keys: ['r'], description: 'Toggle read/unread' },
      { keys: ['⌫'], description: 'Delete selected task(s)' }
    ]
  }
]

const workflows: Workflow[] = [
  {
    title: 'Quick Task Review',
    description: 'Review and edit tasks without touching the mouse.',
    steps: [
      { keys: ['j', 'k'], text: 'Navigate to a task card on the board' },
      { keys: ['Space'], text: 'Open the task with title focused' },
      { keys: ['Enter'], text: 'Move to notes to add details' },
      { keys: ['⌘', '↵'], text: 'Switch to terminal to run commands' },
      { keys: ['Esc'], text: 'Return to the board' }
    ]
  },
  {
    title: 'Triage & Prioritize',
    description: 'Quickly assign priority and status to multiple tasks.',
    steps: [
      { keys: ['j', 'k'], text: 'Navigate to a task' },
      { keys: ['1-4'], text: 'Set priority (1=Urgent, 4=Low)' },
      { keys: ['s', '2'], text: 'Move to In Progress' },
      { keys: ['j'], text: 'Move to next task and repeat' }
    ]
  },
  {
    title: 'Bulk Move Tasks',
    description: 'Select multiple tasks and move them to a new status at once.',
    steps: [
      { keys: ['⇧', '↓'], text: 'Select tasks by holding Shift + Down' },
      { keys: ['s', '3'], text: 'Move all selected to In Review' }
    ]
  }
]

function ShortcutRow({ shortcut }: { shortcut: ShortcutItem }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = !!shortcut.detail

  return (
    <div>
      <div
        style={{
          ...modalStyles.row,
          cursor: hasDetail ? 'pointer' : 'default',
          borderBottom: expanded ? 'none' : '1px solid var(--border)'
        }}
        onClick={() => hasDetail && setExpanded(!expanded)}
        role={hasDetail ? 'button' : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasDetail && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
      >
        <span style={modalStyles.description}>
          {shortcut.description}
          {hasDetail && (
            <span style={modalStyles.expandIcon}>{expanded ? ' ▾' : ' ▸'}</span>
          )}
        </span>
        <span style={modalStyles.keys}>
          {shortcut.keys.map((key, ki) => (
            <span key={ki}>
              {ki > 0 && <span style={modalStyles.keySep}>+</span>}
              <kbd style={modalStyles.kbd}>{key}</kbd>
            </span>
          ))}
        </span>
      </div>
      {expanded && shortcut.detail && (
        <div style={modalStyles.detailRow}>
          {shortcut.detail}
        </div>
      )}
    </div>
  )
}

export function KeyboardShortcutsModal(): React.JSX.Element | null {
  const open = useUIStore((s) => s.shortcutsModalOpen)
  const closeModal = useUIStore((s) => s.closeShortcutsModal)
  const [showWorkflows, setShowWorkflows] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeModal()
      }
    },
    [closeModal]
  )

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, handleKeyDown])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeModal()
      }
    },
    [closeModal]
  )

  if (!open) return null

  return (
    <div style={modalStyles.overlay} onClick={handleOverlayClick} data-testid="shortcuts-overlay">
      <div style={modalStyles.wrapper}>
        <div style={modalStyles.header}>
          <div style={modalStyles.headerTabs}>
            <button
              style={{
                ...modalStyles.tab,
                ...(showWorkflows ? {} : modalStyles.tabActive)
              }}
              onClick={() => setShowWorkflows(false)}
            >
              Shortcuts
            </button>
            <button
              style={{
                ...modalStyles.tab,
                ...(showWorkflows ? modalStyles.tabActive : {})
              }}
              onClick={() => setShowWorkflows(true)}
              data-testid="workflows-tab"
            >
              Workflows
            </button>
          </div>
          <button style={modalStyles.closeButton} onClick={closeModal}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M11 3L3 11M3 3l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div style={modalStyles.body}>
          {showWorkflows ? (
            <div>
              {workflows.map((workflow) => (
                <div key={workflow.title} style={modalStyles.group}>
                  <div style={modalStyles.groupTitle}>{workflow.title}</div>
                  <div style={modalStyles.workflowDescription}>{workflow.description}</div>
                  {workflow.steps.map((step, i) => (
                    <div key={i} style={modalStyles.workflowStep}>
                      <span style={modalStyles.stepNumber}>{i + 1}</span>
                      <span style={modalStyles.keys}>
                        {step.keys.map((key, ki) => (
                          <span key={ki}>
                            {ki > 0 && <span style={modalStyles.keySep}>/</span>}
                            <kbd style={modalStyles.kbd}>{key}</kbd>
                          </span>
                        ))}
                      </span>
                      <span style={modalStyles.stepText}>{step.text}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            shortcutGroups.map((group) => (
              <div key={group.title} style={modalStyles.group}>
                <div style={modalStyles.groupTitle}>{group.title}</div>
                {group.shortcuts.map((shortcut, i) => (
                  <ShortcutRow key={i} shortcut={shortcut} />
                ))}
              </div>
            ))
          )}
        </div>
        <div style={modalStyles.footer}>
          <span style={modalStyles.hint}>
            Press <kbd style={modalStyles.kbd}>Esc</kbd> to close
            {!showWorkflows && (
              <> &middot; Click a shortcut with ▸ for details</>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '12vh',
    zIndex: 500,
    animation: 'cmdkFadeIn 120ms ease'
  },
  wrapper: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 8,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    padding: '8px 18px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTabs: {
    display: 'flex',
    gap: 0
  },
  tab: {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-tertiary)',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    transition: 'color 150ms ease, border-color 150ms ease'
  },
  tabActive: {
    color: 'var(--text-primary)',
    borderBottomColor: 'var(--accent)'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  body: {
    padding: '8px 18px 16px',
    overflowY: 'auto',
    flex: 1
  },
  group: {
    marginTop: 12
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 6,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 0',
    borderBottom: '1px solid var(--border)'
  },
  description: {
    fontSize: 13,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  expandIcon: {
    fontSize: 10,
    color: 'var(--text-tertiary)',
    marginLeft: 4
  },
  detailRow: {
    padding: '6px 12px 10px',
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-primary)',
    borderBottom: '1px solid var(--border)',
    borderRadius: '0 0 4px 4px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  keys: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
    marginLeft: 16
  },
  keySep: {
    color: 'var(--text-tertiary)',
    fontSize: 11,
    margin: '0 1px'
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    fontSize: 11,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: 4,
    border: '1px solid var(--border)'
  },
  workflowDescription: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginBottom: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  workflowStep: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 0',
    borderBottom: '1px solid var(--border)'
  },
  stepNumber: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
    backgroundColor: 'var(--accent-subtle)',
    borderRadius: '50%',
    flexShrink: 0,
    fontFamily: "'SF Mono', 'Fira Code', monospace"
  },
  stepText: {
    fontSize: 13,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  footer: {
    padding: '8px 18px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'center'
  },
  hint: {
    fontSize: 11,
    color: 'var(--text-tertiary)',
    display: 'flex',
    alignItems: 'center',
    gap: 6
  }
}
