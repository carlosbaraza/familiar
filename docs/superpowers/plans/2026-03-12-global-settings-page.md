# Global Settings Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a VS Code-style visual settings page that renders `settings.json` with proper controls, embeds snippet settings inline, and is accessible via navbar gear icon + command palette.

**Architecture:** New `settingsOpen` state in UI store controls a full-page `SettingsPage` component rendered in App.tsx (board/task-detail hidden when settings is open). Snippet editor is extracted from the existing modal into a reusable component. Gear icon in Navbar + "Open Settings" in command palette + Cmd+, shortcut all open settings.

**Tech Stack:** React 19, Zustand, inline styles (matching existing pattern), existing IPC settings API (`window.api.readSettings/writeSettings`)

---

## Chunk 1: UI Store + Settings Page Shell + Navigation

### Task 1: Add settingsOpen state to UI store

**Files:**
- Modify: `src/renderer/src/stores/ui-store.ts`

- [ ] **Step 1: Add settingsOpen state and actions to UIState interface and store**

Add to the UIState interface after `commandPaletteOpen`:

```typescript
// Settings page
settingsOpen: boolean
```

Add actions:

```typescript
openSettings: () => void
closeSettings: () => void
```

Add to the store initial state:

```typescript
settingsOpen: false,
```

Add action implementations:

```typescript
openSettings: () => set({ settingsOpen: true, taskDetailOpen: false, commandPaletteOpen: false }),
closeSettings: () => set({ settingsOpen: false }),
```

Note: `openSettings` also closes task detail and command palette to avoid overlay conflicts.

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/stores/ui-store.ts
git commit -m "feat: add settingsOpen state to UI store"
```

---

### Task 2: Create SettingsPage shell component

**Files:**
- Create: `src/renderer/src/components/settings/SettingsPage.tsx`
- Create: `src/renderer/src/components/settings/index.ts`

- [ ] **Step 1: Create the SettingsPage component**

Create `src/renderer/src/components/settings/SettingsPage.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'
import type { ProjectSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types/settings'

export function SettingsPage(): React.JSX.Element {
  const closeSettings = useUIStore((s) => s.closeSettings)
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS)
  const [isDirty, setIsDirty] = useState(false)

  // Load settings on mount
  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const s = await window.api.readSettings()
        setSettings(s)
      } catch {
        // Use defaults
      }
    }
    load()
  }, [])

  const handleChange = useCallback(<K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    try {
      await window.api.writeSettings(settings)
      // Notify snippet consumers
      if (settings.snippets) {
        window.dispatchEvent(new CustomEvent('snippets-updated', { detail: settings.snippets }))
      }
      setIsDirty(false)
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }, [settings])

  const handleCancel = useCallback(() => {
    closeSettings()
  }, [closeSettings])

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>Settings</h1>
          <button style={styles.closeButton} onClick={handleCancel} title="Close (Escape)">
            &times;
          </button>
        </div>

        <div style={styles.body}>
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
                placeholder="e.g. claude --dangerously-skip-permissions"
              />
            </div>
          </div>

          {/* Snippets section — placeholder, will be filled in Task 3 */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Snippets</h2>
            <p style={styles.settingDescription}>
              Terminal command shortcuts shown as buttons above the terminal
            </p>
            {/* SnippetSettings component goes here in Task 3 */}
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={handleCancel}>
            Cancel
          </button>
          <button
            style={{
              ...styles.saveButton,
              ...(isDirty ? {} : { opacity: 0.5, cursor: 'default' })
            }}
            onClick={handleSave}
            disabled={!isDirty}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    top: 40, // Below navbar
    backgroundColor: 'var(--bg-primary)',
    zIndex: 300,
    display: 'flex',
    justifyContent: 'center',
    overflowY: 'auto'
  },
  content: {
    width: '100%',
    maxWidth: 720,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%'
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
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '16px 0',
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
```

Create `src/renderer/src/components/settings/index.ts`:

```typescript
export { SettingsPage } from './SettingsPage'
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/
git commit -m "feat: create SettingsPage shell component"
```

---

### Task 3: Wire SettingsPage into App.tsx

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Import SettingsPage and render conditionally**

Add import:
```typescript
import { SettingsPage } from './components/settings'
```

Add store selector:
```typescript
const settingsOpen = useUIStore((s) => s.settingsOpen)
```

Render `<SettingsPage />` inside `<AppShell>`, after `<KanbanBoard />`:
```tsx
{settingsOpen && <SettingsPage />}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: wire SettingsPage into App.tsx"
```

---

### Task 4: Add gear icon to Navbar

**Files:**
- Modify: `src/renderer/src/components/layout/Navbar.tsx`

- [ ] **Step 1: Add gear button to Navbar right group**

Import `openSettings` and `settingsOpen` from UI store:
```typescript
const settingsOpen = useUIStore((s) => s.settingsOpen)
const openSettings = useUIStore((s) => s.openSettings)
```

Add a gear icon button in the `navGroupRight` div, before the AgentSwapWidget:
```tsx
{/* Settings gear */}
<button
  className={`${styles.navButton} ${settingsOpen ? styles.navButtonActive : ''}`}
  onClick={openSettings}
  title="Settings (⌘,)"
>
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M6.5 1.5h3l.4 1.6.8.4 1.5-.7 2.1 2.1-.7 1.5.4.8 1.6.4v3l-1.6.4-.4.8.7 1.5-2.1 2.1-1.5-.7-.8.4-.4 1.6h-3l-.4-1.6-.8-.4-1.5.7-2.1-2.1.7-1.5-.4-.8L1.4 9.5v-3l1.6-.4.4-.8-.7-1.5 2.1-2.1 1.5.7.8-.4.4-1.5z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
  </svg>
</button>
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/layout/Navbar.tsx
git commit -m "feat: add settings gear icon to Navbar"
```

---

### Task 5: Add "Open Settings" to Command Palette

**Files:**
- Modify: `src/renderer/src/components/command-palette/CommandPalette.tsx`

- [ ] **Step 1: Add Open Settings action**

Import `openSettings` from UI store:
```typescript
const openSettings = useUIStore((s) => s.openSettings)
```

Add a new Command.Item in the "Actions" group, after "Toggle Sidebar":
```tsx
<Command.Item
  value="open settings preferences"
  onSelect={() => {
    openSettings()
    handleClose()
  }}
  style={styles.item}
>
  <span style={styles.itemIcon}>&#9881;</span>
  <span style={styles.itemLabel}>Open Settings</span>
  <span style={styles.shortcut}>
    <kbd style={styles.kbd}>&#8984;</kbd>
    <kbd style={styles.kbd}>,</kbd>
  </span>
</Command.Item>
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/command-palette/CommandPalette.tsx
git commit -m "feat: add Open Settings to command palette"
```

---

### Task 6: Update Cmd+, shortcut and Escape to handle settings

**Files:**
- Modify: `src/renderer/src/hooks/useGlobalShortcuts.ts`

- [ ] **Step 1: Change Cmd+, from toggleSidebar to openSettings, add Escape for settings**

Import `openSettings`, `closeSettings`, `settingsOpen` from UI store:
```typescript
const openSettings = useUIStore((s) => s.openSettings)
const closeSettings = useUIStore((s) => s.closeSettings)
const settingsOpen = useUIStore((s) => s.settingsOpen)
```

Change the `Cmd+,` handler from `toggleSidebar()` to `openSettings()`:
```typescript
// Cmd+, — open settings
if (meta && e.key === ',') {
  e.preventDefault()
  openSettings()
  return
}
```

In the Escape handler, add settings close before taskDetail close:
```typescript
if (settingsOpen) {
  e.preventDefault()
  closeSettings()
  return
}
```

Add `openSettings`, `closeSettings`, `settingsOpen` to the dependency array.

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/hooks/useGlobalShortcuts.ts
git commit -m "feat: wire Cmd+, to open settings, Escape to close"
```

---

## Chunk 2: Extract Snippet Editor + Embed in Settings

### Task 7: Extract SnippetSettings from SnippetSettingsModal

**Files:**
- Create: `src/renderer/src/components/settings/SnippetSettings.tsx`

- [ ] **Step 1: Create SnippetSettings as a standalone editor (no modal wrapper)**

This component contains the snippet editing UI extracted from `SnippetSettingsModal.tsx`, but without the overlay/modal/footer chrome. It receives `snippets` and `onChange` as props.

Create `src/renderer/src/components/settings/SnippetSettings.tsx`:

```tsx
import { useState, useCallback, useRef } from 'react'
import { Tooltip } from '@renderer/components/common'
import { IconPicker, LucideIconByName } from '@renderer/components/terminal/IconPicker'
import type { Snippet } from '@shared/types'

interface SnippetSettingsProps {
  snippets: Snippet[]
  onChange: (snippets: Snippet[]) => void
}

export function SnippetSettings({ snippets, onChange }: SnippetSettingsProps): React.JSX.Element {
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null)
  const [expandedAdvanced, setExpandedAdvanced] = useState<Set<number>>(new Set())
  const iconButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const handleChange = useCallback(
    (index: number, field: keyof Snippet, value: string | boolean) => {
      const next = [...snippets]
      next[index] = { ...next[index], [field]: value }
      onChange(next)
    },
    [snippets, onChange]
  )

  const handleAdd = useCallback(() => {
    onChange([...snippets, { title: '', command: '', pressEnter: true }])
  }, [snippets, onChange])

  const handleRemove = useCallback(
    (index: number) => {
      onChange(snippets.filter((_, i) => i !== index))
      setExpandedAdvanced((prev) => {
        const next = new Set<number>()
        for (const idx of prev) {
          if (idx < index) next.add(idx)
          else if (idx > index) next.add(idx - 1)
        }
        return next
      })
    },
    [snippets, onChange]
  )

  const handleIconSelect = useCallback(
    (index: number, iconName: string) => {
      const next = [...snippets]
      next[index] = { ...next[index], icon: iconName }
      onChange(next)
      setOpenPickerIndex(null)
    },
    [snippets, onChange]
  )

  const handleIconClear = useCallback(
    (index: number) => {
      const next = [...snippets]
      const { icon: _, showIconInDashboard: __, showIconInTerminal: ___, ...rest } = next[index]
      next[index] = rest as Snippet
      onChange(next)
    },
    [snippets, onChange]
  )

  const toggleAdvanced = useCallback((index: number) => {
    setExpandedAdvanced((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  return (
    <div style={styles.wrapper}>
      {snippets.map((snippet, i) => (
        <div key={i} style={styles.snippetBlock}>
          <div style={styles.row}>
            <button
              ref={(el) => {
                if (el) iconButtonRefs.current.set(i, el)
                else iconButtonRefs.current.delete(i)
              }}
              style={snippet.icon ? styles.iconChip : styles.iconPlaceholder}
              onClick={() => setOpenPickerIndex(openPickerIndex === i ? null : i)}
              title={snippet.icon ? `Icon: ${snippet.icon}` : 'Choose icon'}
            >
              {snippet.icon ? (
                <>
                  <LucideIconByName name={snippet.icon} size={14} />
                  <span style={styles.iconName}>{snippet.icon}</span>
                  <span
                    style={styles.iconClear}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleIconClear(i)
                    }}
                  >
                    &times;
                  </span>
                </>
              ) : (
                '+ Icon'
              )}
            </button>
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
            <Tooltip
              placement="top"
              content="When checked, the command runs immediately. Otherwise it's pasted for you to review first."
            >
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={snippet.pressEnter}
                  onChange={(e) => handleChange(i, 'pressEnter', e.target.checked)}
                />
                <span style={styles.checkboxText}>Auto-run</span>
              </label>
            </Tooltip>
            <div style={styles.advancedToggle} onClick={() => toggleAdvanced(i)}>
              {expandedAdvanced.has(i) ? '▾' : '▸'} Advanced
            </div>
            <button style={styles.removeButton} onClick={() => handleRemove(i)} title="Remove">
              &times;
            </button>
          </div>

          {expandedAdvanced.has(i) && (
            <div style={styles.advancedPanel}>
              <label style={styles.advancedCheckbox}>
                <input
                  type="checkbox"
                  checked={snippet.showInDashboard ?? false}
                  onChange={(e) => handleChange(i, 'showInDashboard', e.target.checked)}
                />
                <span style={styles.advancedText}>Show in dashboard</span>
              </label>
              <label style={styles.advancedCheckbox}>
                <input
                  type="checkbox"
                  checked={snippet.showIconInDashboard ?? false}
                  onChange={(e) => handleChange(i, 'showIconInDashboard', e.target.checked)}
                  disabled={!snippet.icon}
                />
                <span
                  style={{
                    ...styles.advancedText,
                    ...(!snippet.icon ? { opacity: 0.4 } : {})
                  }}
                >
                  Icon only in dashboard
                </span>
              </label>
              <label style={styles.advancedCheckbox}>
                <input
                  type="checkbox"
                  checked={snippet.showIconInTerminal ?? false}
                  onChange={(e) => handleChange(i, 'showIconInTerminal', e.target.checked)}
                  disabled={!snippet.icon}
                />
                <span
                  style={{
                    ...styles.advancedText,
                    ...(!snippet.icon ? { opacity: 0.4 } : {})
                  }}
                >
                  Icon only in terminal
                </span>
              </label>
            </div>
          )}

          {openPickerIndex === i && (
            <IconPicker
              selectedIcon={snippet.icon}
              onSelect={(name) => handleIconSelect(i, name)}
              onClose={() => setOpenPickerIndex(null)}
              anchorRect={iconButtonRefs.current.get(i)?.getBoundingClientRect() ?? null}
            />
          )}
        </div>
      ))}

      <button style={styles.addButton} onClick={handleAdd}>
        + Add Snippet
      </button>
    </div>
  )
}

// Styles reused from SnippetSettingsModal (same visual appearance)
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  snippetBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  row: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  iconPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 8px',
    borderRadius: '5px',
    border: '1px dashed var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-tertiary)',
    fontSize: '11px',
    cursor: 'pointer',
    minWidth: '70px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    flexShrink: 0
  },
  iconChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 8px',
    borderRadius: '5px',
    border: '1px solid rgba(99,102,241,0.3)',
    backgroundColor: 'rgba(99,102,241,0.08)',
    color: '#818cf8',
    fontSize: '11px',
    cursor: 'pointer',
    minWidth: '70px',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    flexShrink: 0
  },
  iconName: { fontSize: '11px' },
  iconClear: {
    marginLeft: '2px',
    fontSize: '13px',
    lineHeight: 1,
    cursor: 'pointer',
    opacity: 0.6
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
    marginLeft: '4px',
    lineHeight: 1,
    flexShrink: 0
  },
  advancedToggle: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    marginLeft: '8px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    userSelect: 'none',
    flexShrink: 0,
    whiteSpace: 'nowrap'
  },
  advancedPanel: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: '5px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  advancedCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  },
  advancedText: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
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
  }
}
```

- [ ] **Step 2: Export from index**

Update `src/renderer/src/components/settings/index.ts`:
```typescript
export { SettingsPage } from './SettingsPage'
export { SnippetSettings } from './SnippetSettings'
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/settings/
git commit -m "feat: extract SnippetSettings as standalone component"
```

---

### Task 8: Integrate SnippetSettings into SettingsPage

**Files:**
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`

- [ ] **Step 1: Import and render SnippetSettings in the Snippets section**

Import:
```typescript
import { SnippetSettings } from './SnippetSettings'
import { DEFAULT_SNIPPETS } from '@shared/types/settings'
```

Replace the snippet section placeholder with:
```tsx
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
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/SettingsPage.tsx
git commit -m "feat: embed SnippetSettings in SettingsPage"
```

---

### Task 9: Update TerminalPanel gear icon to open settings page

**Files:**
- Modify: `src/renderer/src/components/terminal/TerminalPanel.tsx`

- [ ] **Step 1: Change gear icon to open global settings instead of snippet modal**

Import `openSettings` from UI store:
```typescript
import { useUIStore } from '@renderer/stores/ui-store'
```

Inside the component, get the action:
```typescript
const openSettings = useUIStore((s) => s.openSettings)
```

Change the gear button's onClick from `() => setShowSnippetSettings(true)` to `openSettings`:
```tsx
<Tooltip placement="bottom" content="Open settings">
  <button
    style={panelStyles.gearButton}
    onClick={openSettings}
  >
    &#9881;
  </button>
</Tooltip>
```

Remove the `showSnippetSettings` state variable and the `SnippetSettingsModal` rendering at the bottom of the return. Also remove the `SnippetSettingsModal` import.

Keep the `SnippetSettingsModal` file itself — it's not deleted, just no longer used from TerminalPanel. It can be removed in a future cleanup.

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Verify the app runs**

Run: `npm run dev`
Test: Click gear icon in terminal panel → settings page opens. Click gear in navbar → same. Cmd+, → same. Escape → closes.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/terminal/TerminalPanel.tsx
git commit -m "feat: terminal gear icon now opens global settings page"
```

---

### Task 10: Final verification and single feature commit

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Manual smoke test**

1. `npm run dev`
2. Click gear icon in navbar → settings page opens
3. Edit default command → Save → verify saved to `.familiar/settings.json`
4. Add/remove/edit snippets → Save → verify snippets update in terminal panel
5. Open settings via Cmd+, → works
6. Open settings via command palette (Cmd+K → "Settings") → works
7. Press Escape → settings closes
8. Open a task → gear icon in terminal bar → opens settings page
