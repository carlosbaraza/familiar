# Multi-Agent Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `codingAgent` setting with an array of agent profiles, each with its own default command, snippets, and icon, plus a quick-switch select in the task creation UI.

**Architecture:** Add `AgentProfile` type and `agents[]`/`activeAgentId` to `ProjectSettings`. Tasks get stamped with `agentId` on creation. Terminal startup resolves the agent's command from the profile. Settings page gets card-based agent management. Migration auto-converts old `codingAgent` to the new array.

**Tech Stack:** React 19, Zustand, TypeScript strict, Vitest, CSS modules

---

### Task 1: Add AgentProfile type and extend settings types

**Files:**
- Modify: `src/shared/types/settings.ts:18-23,32-57`
- Modify: `src/shared/utils/id-generator.ts:19-21`

- [ ] **Step 1: Add generateAgentId to id-generator.ts**

In `src/shared/utils/id-generator.ts`, add after line 17:

```typescript
export function generateAgentId(): string {
  return `agent_${nanoid(8)}`
}
```

- [ ] **Step 2: Update CodingAgent type and add AgentProfile**

In `src/shared/types/settings.ts`, replace lines 18-23 with:

```typescript
export type AgentType = 'claude-code' | 'codex' | 'other'

/** @deprecated Use AgentType instead */
export type CodingAgent = AgentType

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  other: 'Other'
}

/** @deprecated Use AGENT_TYPE_LABELS instead */
export const CODING_AGENT_LABELS = AGENT_TYPE_LABELS

export const AGENT_TYPE_ICONS: Record<AgentType, string> = {
  'claude-code': 'claude-code',
  codex: 'codex',
  other: 'terminal'
}

export const AGENT_TYPE_DEFAULT_COMMANDS: Record<AgentType, string> = {
  'claude-code':
    'claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions --resume $FAMILIAR_TASK_ID',
  codex: 'codex --full-auto',
  other: ''
}

export interface AgentProfile {
  id: string
  type: AgentType
  name: string
  icon: string
  defaultCommand: string
  snippets: Snippet[]
}
```

- [ ] **Step 3: Add agents and activeAgentId to ProjectSettings**

In `src/shared/types/settings.ts`, add these fields to the `ProjectSettings` interface after the `codingAgent` field:

```typescript
  /** Configured agent profiles */
  agents?: AgentProfile[]
  /** ID of the currently active agent for new tasks */
  activeAgentId?: string
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors (existing code still uses `CodingAgent` which is aliased)

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/settings.ts src/shared/utils/id-generator.ts
git commit -m "feat: add AgentProfile type and extend ProjectSettings"
```

---

### Task 2: Add agentId to Task type

**Files:**
- Modify: `src/shared/types/task.ts:18-33`

- [ ] **Step 1: Add agentId field to Task interface**

In `src/shared/types/task.ts`, add after the `subtaskIds` field (line 32):

```typescript
  agentId?: string // ID of the agent profile used for this task
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors (field is optional)

- [ ] **Step 3: Commit**

```bash
git add src/shared/types/task.ts
git commit -m "feat: add agentId field to Task type"
```

---

### Task 3: Create AgentIcons component

**Files:**
- Create: `src/renderer/src/components/common/AgentIcons.tsx`

- [ ] **Step 1: Create the AgentIcons component**

Create `src/renderer/src/components/common/AgentIcons.tsx`:

```tsx
import type { AgentType } from '@shared/types/settings'

interface AgentIconProps {
  size?: number
  className?: string
}

export function ClaudeIcon({ size = 16, className }: AgentIconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
        fill="#D97757"
        fillRule="nonzero"
      />
    </svg>
  )
}

export function OpenAIIcon({ size = 16, className }: AgentIconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" />
    </svg>
  )
}

/** Render the appropriate icon for an agent type or custom icon name */
export function AgentIcon({
  agentType,
  icon,
  size = 16,
  className
}: {
  agentType: AgentType
  icon?: string
  size?: number
  className?: string
}): React.JSX.Element {
  // Known types get brand icons
  if (agentType === 'claude-code') return <ClaudeIcon size={size} className={className} />
  if (agentType === 'codex') return <OpenAIIcon size={size} className={className} />

  // "other" — render a Lucide-style SVG icon
  // For simplicity, use a terminal icon as default for "other"
  // The icon name is stored but we render a generic terminal icon
  // (A full Lucide icon picker would dynamically import icons)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}
```

- [ ] **Step 2: Export from common/index.ts**

In `src/renderer/src/components/common/index.ts`, add:

```typescript
export { AgentIcon, ClaudeIcon, OpenAIIcon } from './AgentIcons'
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/common/AgentIcons.tsx src/renderer/src/components/common/index.ts
git commit -m "feat: add AgentIcon components with Claude and OpenAI brand SVGs"
```

---

### Task 4: Add settings migration for old codingAgent to agents[]

**Files:**
- Modify: `src/main/services/data-service.ts:414-440`
- Test: `src/main/services/data-service.test.ts`

- [ ] **Step 1: Write the migration test**

Add to `src/main/services/data-service.test.ts`:

```typescript
import { generateAgentId } from '@shared/utils/id-generator'

describe('readSettings agent migration', () => {
  it('migrates old codingAgent to agents array', async () => {
    // Write settings with old codingAgent field, no agents array
    const oldSettings = {
      codingAgent: 'claude-code',
      defaultCommand: 'claude --resume $FAMILIAR_TASK_ID',
      snippets: [{ title: 'Start', command: '/familiar-agent', pressEnter: true }]
    }
    await ds.writeSettings(oldSettings as ProjectSettings)

    const result = await ds.readSettings()

    expect(result.agents).toBeDefined()
    expect(result.agents).toHaveLength(1)
    expect(result.agents![0].type).toBe('claude-code')
    expect(result.agents![0].name).toBe('Claude Code')
    expect(result.agents![0].defaultCommand).toBe('claude --resume $FAMILIAR_TASK_ID')
    expect(result.agents![0].snippets).toEqual(oldSettings.snippets)
    expect(result.activeAgentId).toBe(result.agents![0].id)
  })

  it('does not migrate when agents array already exists', async () => {
    const existing = {
      codingAgent: 'claude-code',
      agents: [{ id: 'agent_existing', type: 'claude-code', name: 'My Claude', icon: 'claude-code', defaultCommand: 'claude', snippets: [] }],
      activeAgentId: 'agent_existing'
    }
    await ds.writeSettings(existing as ProjectSettings)

    const result = await ds.readSettings()

    expect(result.agents).toHaveLength(1)
    expect(result.agents![0].id).toBe('agent_existing')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/services/data-service.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — migration logic not implemented yet

- [ ] **Step 3: Implement migration in readSettings**

In `src/main/services/data-service.ts`, in the `readSettings()` method, after the existing labels migration block (after the `if (!settings.labels)` block, around line 437), add:

```typescript
    // Migrate: if old codingAgent exists but no agents array, convert
    if (settings.codingAgent && (!settings.agents || settings.agents.length === 0)) {
      const { generateAgentId } = await import('@shared/utils/id-generator')
      const { AGENT_TYPE_LABELS, AGENT_TYPE_ICONS } = await import('@shared/types/settings')
      const agentType = settings.codingAgent
      const profile: import('@shared/types/settings').AgentProfile = {
        id: generateAgentId(),
        type: agentType,
        name: AGENT_TYPE_LABELS[agentType] ?? agentType,
        icon: AGENT_TYPE_ICONS[agentType] ?? 'terminal',
        defaultCommand: settings.defaultCommand ?? '',
        snippets: settings.snippets ?? []
      }
      settings.agents = [profile]
      settings.activeAgentId = profile.id
      await this.writeSettings(settings)
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/services/data-service.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/data-service.ts src/main/services/data-service.test.ts
git commit -m "feat: migrate old codingAgent to agents array on settings load"
```

---

### Task 5: Stamp agentId on task creation

**Files:**
- Modify: `src/renderer/src/stores/task-store.ts:138-185`
- Test: `src/renderer/src/stores/task-store.test.ts`

- [ ] **Step 1: Write the test**

Add to `src/renderer/src/stores/task-store.test.ts` in the `addTask` describe block:

```typescript
it('stamps agentId from options when provided', async () => {
  const task = await useTaskStore.getState().addTask('Test task', { agentId: 'agent_test123' })
  expect(task.agentId).toBe('agent_test123')
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/stores/task-store.test.ts -t "stamps agentId" --reporter=verbose 2>&1 | tail -10`
Expected: PASS — `agentId` is already spread via `...options` in the `addTask` implementation (line 167). The test confirms this works.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/stores/task-store.test.ts
git commit -m "test: verify agentId is stamped on task creation"
```

---

### Task 6: Resolve agent command in terminal startup

**Files:**
- Modify: `src/main/platform/electron-pty.ts:318-328`
- Test: `src/main/platform/electron-pty.test.ts`

- [ ] **Step 1: Write the test**

Add to `src/main/platform/electron-pty.test.ts`:

```typescript
describe('agent profile command resolution', () => {
  it('uses agent profile defaultCommand when task has agentId', async () => {
    const agentProfile = {
      id: 'agent_test1',
      type: 'claude-code' as const,
      name: 'Claude Code',
      icon: 'claude-code',
      defaultCommand: 'claude --custom-flag',
      snippets: []
    }
    mockDataService.readSettings.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      agents: [agentProfile],
      activeAgentId: 'agent_test1'
    })
    mockDataService.readTask.mockResolvedValue({
      id: 'tsk_test01',
      agentId: 'agent_test1',
      title: 'Test',
      status: 'todo',
      priority: 'none',
      labels: [],
      agentStatus: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortOrder: 0
    })

    await ptyManager.create('tsk_test01', 'pane-0', '/tmp')

    // Verify the warmup used the agent's command
    expect(mockTmux.warmupSession).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.stringContaining('claude --custom-flag')
    )
  })

  it('falls back to global defaultCommand when agentId references deleted agent', async () => {
    mockDataService.readSettings.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      defaultCommand: 'claude --global',
      agents: [],
      activeAgentId: undefined
    })
    mockDataService.readTask.mockResolvedValue({
      id: 'tsk_test01',
      agentId: 'agent_deleted',
      title: 'Test',
      status: 'todo',
      priority: 'none',
      labels: [],
      agentStatus: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortOrder: 0
    })

    await ptyManager.create('tsk_test01', 'pane-0', '/tmp')

    expect(mockTmux.warmupSession).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.stringContaining('claude --global')
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/platform/electron-pty.test.ts -t "agent profile" --reporter=verbose 2>&1 | tail -20`
Expected: FAIL

- [ ] **Step 3: Implement agent command resolution**

In `src/main/platform/electron-pty.ts`, modify the command resolution block (around line 318-328). Replace the `commandPromise` logic:

```typescript
if (isNewSession && tmuxSessionName) {
  const commandPromise = overrideCommand
    ? Promise.resolve(overrideCommand)
    : this._dataService
      ? (async () => {
          const settings = await this._dataService!.readSettings()
          let command = settings.defaultCommand

          // Try to resolve agent-specific command from task's agentId
          try {
            const task = await this._dataService!.readTask(taskId)
            if (task.agentId && settings.agents?.length) {
              const agent = settings.agents.find((a) => a.id === task.agentId)
              if (agent?.defaultCommand) {
                command = agent.defaultCommand
              }
            }
          } catch {
            // Task not readable yet — use global default
          }

          if (command) {
            return resolveClaudeSessionCommand(command, taskId, cwd)
          }
          return undefined
        })()
      : Promise.resolve(undefined)

  commandPromise.then((command) => {
    return this._tmux.warmupSession(tmuxSessionName, familiarEnv, command)
  }).catch((err) => {
    console.warn('Failed to warm up tmux session:', err)
  })
}
```

Also ensure `readTask` is available on the data service interface. Check if it already exists — if not, add it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/platform/electron-pty.test.ts -t "agent profile" --reporter=verbose 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/platform/electron-pty.ts src/main/platform/electron-pty.test.ts
git commit -m "feat: resolve agent-specific command from task agentId in PTY"
```

---

### Task 7: Add agent select to CreateTaskInput

**Files:**
- Modify: `src/renderer/src/components/common/CreateTaskInput.tsx`
- Modify: `src/renderer/src/components/common/CreateTaskInput.module.css`

- [ ] **Step 1: Add agent props to CreateTaskInput**

In `src/renderer/src/components/common/CreateTaskInput.tsx`, add new props to `CreateTaskInputProps`:

```typescript
import type { AgentProfile } from '@shared/types/settings'

// Add to CreateTaskInputProps interface:
  /** Available agent profiles for the agent selector */
  agents?: AgentProfile[]
  /** Currently active agent ID */
  activeAgentId?: string
  /** Called when the user switches agent */
  onAgentChange?: (agentId: string) => void
```

- [ ] **Step 2: Add agent select to the footer JSX**

In the component body, destructure the new props. In the footer div (around line 349), add the agent select before the hint:

```tsx
<div className={styles.footer}>
  {agents && agents.length > 0 && (
    <div className={styles.agentSelect}>
      <AgentIcon
        agentType={agents.find((a) => a.id === activeAgentId)?.type ?? 'other'}
        size={14}
      />
      <select
        className={styles.agentSelectDropdown}
        value={activeAgentId ?? ''}
        onChange={(e) => onAgentChange?.(e.target.value)}
      >
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
    </div>
  )}
  {agents !== undefined && agents.length === 0 && (
    <div className={styles.agentWarning} title="No agents configured — go to Settings">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </div>
  )}
  <span className={styles.hint}>Enter to create</span>
  <button
    type="button"
    className={styles.createButton}
    disabled={!hasContent}
    onClick={doSubmit}
  >
    {parentId ? 'Create Subtask' : 'Create Task'}
  </button>
</div>
```

Add the import at the top:

```typescript
import { AgentIcon } from './AgentIcons'
```

- [ ] **Step 3: Add CSS for agent select**

In `src/renderer/src/components/common/CreateTaskInput.module.css`, add:

```css
/* ---- Agent select ---- */

.agentSelect {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-right: auto;
}

.agentSelectDropdown {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 11px;
  padding: 2px 4px;
  cursor: pointer;
  outline: none;
  max-width: 140px;
}

.agentSelectDropdown:hover {
  border-color: var(--text-tertiary);
}

.agentSelectDropdown:focus {
  border-color: var(--accent);
}

.agentWarning {
  display: flex;
  align-items: center;
  margin-right: auto;
  cursor: help;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/common/CreateTaskInput.tsx src/renderer/src/components/common/CreateTaskInput.module.css
git commit -m "feat: add agent select dropdown to CreateTaskInput footer"
```

---

### Task 8: Wire agent data through KanbanBoard → KanbanColumn → CreateTaskInput

**Files:**
- Modify: `src/renderer/src/components/board/KanbanBoard.tsx:102-129,600-620`
- Modify: `src/renderer/src/components/board/KanbanColumn.tsx:17-70`

- [ ] **Step 1: Load agents in KanbanBoard and pass to columns**

In `src/renderer/src/components/board/KanbanBoard.tsx`, add state for agents alongside the existing snippets state (around line 102):

```typescript
const [agents, setAgents] = useState<AgentProfile[]>([])
const [activeAgentId, setActiveAgentId] = useState<string | undefined>(undefined)
```

Add import at top:

```typescript
import type { AgentProfile } from '@shared/types/settings'
```

In the existing `loadSnippets` useEffect (around line 104), extend it to also load agents:

```typescript
useEffect(() => {
  async function loadSettings(): Promise<void> {
    try {
      const settings = await window.api.readSettings()
      if (settings.snippets && settings.snippets.length > 0) {
        setSnippets(settings.snippets)
      }
      if (settings.agents) {
        setAgents(settings.agents)
        setActiveAgentId(settings.activeAgentId)
        // If active agent has snippets, use those instead of global
        const activeAgent = settings.agents.find((a) => a.id === settings.activeAgentId)
        if (activeAgent?.snippets?.length) {
          setSnippets(activeAgent.snippets)
        }
      }
    } catch {
      // Use defaults
    }
  }
  loadSettings()

  function handleSnippetsUpdated(e: Event): void {
    const detail = (e as CustomEvent<Snippet[]>).detail
    setSnippets(detail.length > 0 ? detail : DEFAULT_SNIPPETS)
  }
  function handleAgentsUpdated(e: Event): void {
    const detail = (e as CustomEvent<{ agents: AgentProfile[]; activeAgentId?: string }>).detail
    setAgents(detail.agents)
    setActiveAgentId(detail.activeAgentId)
  }
  window.addEventListener('snippets-updated', handleSnippetsUpdated)
  window.addEventListener('agents-updated', handleAgentsUpdated)
  return () => {
    window.removeEventListener('snippets-updated', handleSnippetsUpdated)
    window.removeEventListener('agents-updated', handleAgentsUpdated)
  }
}, [])
```

Add `handleAgentChange` callback:

```typescript
const handleAgentChange = useCallback(async (agentId: string) => {
  setActiveAgentId(agentId)
  const agent = agents.find((a) => a.id === agentId)
  if (agent?.snippets?.length) {
    setSnippets(agent.snippets)
  }
  // Persist the selection
  try {
    const settings = await window.api.readSettings()
    await window.api.writeSettings({ ...settings, activeAgentId: agentId })
  } catch {
    // Non-critical
  }
}, [agents])
```

Pass to `KanbanColumn` (in the JSX where columns are rendered):

```tsx
agents={agents}
activeAgentId={activeAgentId}
onAgentChange={handleAgentChange}
```

- [ ] **Step 2: Thread props through KanbanColumn**

In `src/renderer/src/components/board/KanbanColumn.tsx`, add to `KanbanColumnProps`:

```typescript
import type { AgentProfile } from '@shared/types/settings'

// Add to interface:
  agents?: AgentProfile[]
  activeAgentId?: string
  onAgentChange?: (agentId: string) => void
```

Destructure in the component and pass to `CreateTaskInput`:

```tsx
<CreateTaskInput
  variant="square"
  onSubmit={handleCreateTask}
  allSnippets={allSnippets}
  agents={agents}
  activeAgentId={activeAgentId}
  onAgentChange={onAgentChange}
  // ... existing props
/>
```

- [ ] **Step 3: Update addTask call to include agentId**

In `KanbanBoard.tsx`, update the `handleCreateTask` callback to include the active agent ID. Find where `addTask` is called and add `agentId: activeAgentId` to the options:

```typescript
const handleCreateTask = useCallback(
  async (title: string, document?: string, enabledSnippets?: Snippet[], pendingImages?: PendingImage[], pendingPastedFiles?: PendingPastedFile[]) => {
    // ... existing logic ...
    await addTask(title, {
      status: targetColumn,
      agentId: activeAgentId,
      // ... existing options
    })
    // ... rest of handler
  },
  [addTask, activeAgentId, /* ... existing deps */]
)
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/board/KanbanBoard.tsx src/renderer/src/components/board/KanbanColumn.tsx
git commit -m "feat: wire agent profiles through KanbanBoard to CreateTaskInput"
```

---

### Task 9: Replace Settings page Coding Agent section with agent cards

**Files:**
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx:155-184`

- [ ] **Step 1: Replace the Coding Agent section**

In `src/renderer/src/components/settings/SettingsPage.tsx`, replace the Coding Agent section (lines 155-184) with agent card management UI.

Update imports at top of file:

```typescript
import type { ProjectSettings, AgentProfile } from '@shared/types'
import type { AgentType, CodeEditor } from '@shared/types/settings'
import { DEFAULT_SETTINGS, DEFAULT_SNIPPETS, AGENT_TYPE_LABELS, AGENT_TYPE_DEFAULT_COMMANDS, AGENT_TYPE_ICONS, CODE_EDITOR_LABELS } from '@shared/types/settings'
import { generateAgentId } from '@shared/utils/id-generator'
import { AgentIcon } from '@renderer/components/common/AgentIcons'
```

Remove the old `CodingAgent` and `CODING_AGENT_LABELS` imports.

Add agent management state inside the component:

```typescript
const [editingAgentId, setEditingAgentId] = useState<string | null>(null)
const [addingAgent, setAddingAgent] = useState(false)
const [newAgentType, setNewAgentType] = useState<AgentType>('claude-code')
const [newAgentName, setNewAgentName] = useState('')
const [newAgentCommand, setNewAgentCommand] = useState('')
const [newAgentIcon, setNewAgentIcon] = useState('terminal')
```

Add agent management callbacks:

```typescript
const handleAddAgent = useCallback(() => {
  const type = newAgentType
  const profile: AgentProfile = {
    id: generateAgentId(),
    type,
    name: newAgentName || AGENT_TYPE_LABELS[type],
    icon: AGENT_TYPE_ICONS[type],
    defaultCommand: newAgentCommand || AGENT_TYPE_DEFAULT_COMMANDS[type],
    snippets: type === 'claude-code' ? DEFAULT_SNIPPETS : []
  }
  if (type === 'other') {
    profile.icon = newAgentIcon
  }
  const agents = [...(settings.agents ?? []), profile]
  const activeAgentId = settings.activeAgentId ?? profile.id
  handleChange('agents', agents)
  if (!settings.activeAgentId) {
    handleChange('activeAgentId', activeAgentId)
  }
  setAddingAgent(false)
  setNewAgentType('claude-code')
  setNewAgentName('')
  setNewAgentCommand('')
  setNewAgentIcon('terminal')
  // Dispatch event for KanbanBoard
  window.dispatchEvent(new CustomEvent('agents-updated', { detail: { agents, activeAgentId } }))
}, [settings, newAgentType, newAgentName, newAgentCommand, newAgentIcon, handleChange])

const handleDeleteAgent = useCallback((agentId: string) => {
  const agents = (settings.agents ?? []).filter((a) => a.id !== agentId)
  handleChange('agents', agents)
  if (settings.activeAgentId === agentId) {
    const newActiveId = agents.length > 0 ? agents[0].id : undefined
    handleChange('activeAgentId', newActiveId)
  }
  window.dispatchEvent(new CustomEvent('agents-updated', { detail: { agents, activeAgentId: settings.activeAgentId === agentId ? (agents[0]?.id) : settings.activeAgentId } }))
}, [settings, handleChange])

const handleSetActiveAgent = useCallback((agentId: string) => {
  handleChange('activeAgentId', agentId)
  window.dispatchEvent(new CustomEvent('agents-updated', { detail: { agents: settings.agents ?? [], activeAgentId: agentId } }))
}, [settings, handleChange])
```

Replace the Coding Agent section JSX (lines 155-184) with:

```tsx
{/* Coding Agents section */}
<div style={styles.section}>
  <h2 style={styles.sectionTitle}>Coding Agents</h2>

  {(settings.agents ?? []).map((agent) => (
    <div key={agent.id} style={{
      ...styles.settingRow,
      border: agent.id === settings.activeAgentId ? '1px solid var(--accent)' : '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-3)',
      marginBottom: 'var(--space-2)',
      position: 'relative' as const
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', width: '100%' }}>
        <AgentIcon agentType={agent.type} size={20} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...styles.settingLabel, marginBottom: 2 }}>{agent.name}</div>
          <div style={{ ...styles.settingDescription, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
            {agent.defaultCommand || 'No command configured'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
          {agent.id === settings.activeAgentId && (
            <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' as const }}>Active</span>
          )}
          {agent.id !== settings.activeAgentId && (
            <button
              style={{ ...styles.backButton, fontSize: 11, padding: '2px 8px' }}
              onClick={() => handleSetActiveAgent(agent.id)}
            >
              Set Active
            </button>
          )}
          <button
            style={{ ...styles.backButton, fontSize: 11, padding: '2px 8px', color: 'var(--text-error)' }}
            onClick={() => handleDeleteAgent(agent.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  ))}

  {addingAgent ? (
    <div style={{ ...styles.settingRow, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 'var(--space-2)', width: '100%' }}>
        <div>
          <label style={{ ...styles.settingLabel, fontSize: 11, marginBottom: 4, display: 'block' }}>Agent Type</label>
          <select
            style={styles.textInput}
            value={newAgentType}
            onChange={(e) => {
              const type = e.target.value as AgentType
              setNewAgentType(type)
              setNewAgentName(AGENT_TYPE_LABELS[type] ?? '')
              setNewAgentCommand(AGENT_TYPE_DEFAULT_COMMANDS[type] ?? '')
              setNewAgentIcon(AGENT_TYPE_ICONS[type] ?? 'terminal')
            }}
          >
            {(Object.keys(AGENT_TYPE_LABELS) as AgentType[]).map((key) => (
              <option key={key} value={key}>{AGENT_TYPE_LABELS[key]}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ ...styles.settingLabel, fontSize: 11, marginBottom: 4, display: 'block' }}>Name</label>
          <input
            style={styles.textInput}
            type="text"
            value={newAgentName}
            onChange={(e) => setNewAgentName(e.target.value)}
            placeholder={AGENT_TYPE_LABELS[newAgentType]}
          />
        </div>
        <div>
          <label style={{ ...styles.settingLabel, fontSize: 11, marginBottom: 4, display: 'block' }}>Default Command</label>
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
            <label style={{ ...styles.settingLabel, fontSize: 11, marginBottom: 4, display: 'block' }}>Icon (Lucide name)</label>
            <input
              style={styles.textInput}
              type="text"
              value={newAgentIcon}
              onChange={(e) => setNewAgentIcon(e.target.value)}
              placeholder="terminal"
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <button style={{ ...styles.backButton, fontSize: 11, padding: '4px 12px' }} onClick={() => setAddingAgent(false)}>Cancel</button>
          <button style={{ ...styles.backButton, fontSize: 11, padding: '4px 12px', backgroundColor: 'var(--accent)', color: 'white' }} onClick={handleAddAgent}>Add Agent</button>
        </div>
      </div>
    </div>
  ) : (
    <button
      style={{ ...styles.backButton, fontSize: 12, padding: '6px 12px', width: '100%', textAlign: 'center' as const }}
      onClick={() => {
        setAddingAgent(true)
        setNewAgentName(AGENT_TYPE_LABELS[newAgentType])
        setNewAgentCommand(AGENT_TYPE_DEFAULT_COMMANDS[newAgentType])
      }}
    >
      + Add Agent
    </button>
  )}
</div>
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/SettingsPage.tsx
git commit -m "feat: replace single agent dropdown with agent cards in Settings"
```

---

### Task 10: Update onboarding to create AgentProfile

**Files:**
- Modify: `src/renderer/src/components/onboarding/Onboarding.tsx:126-147,498-543`

- [ ] **Step 1: Update handleSelectAgent to create AgentProfile**

In `src/renderer/src/components/onboarding/Onboarding.tsx`, update imports:

```typescript
import type { AgentType, ProjectSettings } from '@shared/types'
import { AGENT_TYPE_LABELS, AGENT_TYPE_ICONS, AGENT_TYPE_DEFAULT_COMMANDS } from '@shared/types/settings'
import { generateAgentId } from '@shared/utils/id-generator'
```

Update the `selectedAgent` state type:

```typescript
const [selectedAgent, setSelectedAgent] = useState<AgentType | null>(null)
```

Replace the `handleSelectAgent` callback (lines 126-147):

```typescript
const handleSelectAgent = useCallback(
  async (agent: AgentType) => {
    setSelectedAgent(agent)

    // Create agent profile and save to settings
    try {
      const settings = await window.api.readSettings()
      const profile = {
        id: generateAgentId(),
        type: agent,
        name: AGENT_TYPE_LABELS[agent],
        icon: AGENT_TYPE_ICONS[agent],
        defaultCommand: AGENT_TYPE_DEFAULT_COMMANDS[agent],
        snippets: agent === 'claude-code'
          ? (settings.snippets ?? [{ title: 'Start', command: '/familiar-agent', pressEnter: true }])
          : []
      }
      const updated: ProjectSettings = {
        ...settings,
        codingAgent: agent,  // Keep for backward compat
        agents: [...(settings.agents ?? []), profile],
        activeAgentId: profile.id,
        skipDoctor
      }
      await window.api.writeSettings(updated)
    } catch {
      // Will be saved later
    }

    setStep('install-cli')
  },
  [skipDoctor]
)
```

- [ ] **Step 2: Add Codex card to agent selection grid**

In the `select-agent` step JSX (around line 514), add a Codex button between Claude Code and Other:

```tsx
<div style={styles.agentGrid}>
  <button style={styles.agentCard} onClick={() => handleSelectAgent('claude-code')}>
    <div style={styles.agentIcon}>
      <ClaudeIcon size={32} />
    </div>
    <span style={styles.agentName}>{AGENT_TYPE_LABELS['claude-code']}</span>
    <span style={styles.agentBadge}>Recommended</span>
  </button>

  <button style={styles.agentCard} onClick={() => handleSelectAgent('codex')}>
    <div style={styles.agentIcon}>
      <OpenAIIcon size={32} />
    </div>
    <span style={styles.agentName}>{AGENT_TYPE_LABELS['codex']}</span>
  </button>

  <button style={styles.agentCard} onClick={() => handleSelectAgent('other')}>
    <div style={styles.agentIcon}>
      <QuestionIcon size={32} />
    </div>
    <span style={styles.agentName}>Other</span>
    <span style={styles.agentDescription}>Not fully tested</span>
  </button>
</div>
```

Add imports for the icons:

```typescript
import { ClaudeIcon, OpenAIIcon } from '@renderer/components/common/AgentIcons'
```

- [ ] **Step 3: Update onboarding check in KanbanBoard**

In `src/renderer/src/components/board/KanbanBoard.tsx`, update the onboarding check (around line 85) to use `agents` instead of `codingAgent`:

```typescript
const agentConfigured = (settings.agents?.length ?? 0) > 0 || !!settings.codingAgent
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/onboarding/Onboarding.tsx src/renderer/src/components/board/KanbanBoard.tsx
git commit -m "feat: update onboarding to create AgentProfile with Codex option"
```

---

### Task 11: Update health checks for multi-agent

**Files:**
- Modify: `src/main/ipc/health-handlers.ts:310-405,440-470`
- Test: `src/main/ipc/health-handlers.test.ts`

- [ ] **Step 1: Write the test**

Add to `src/main/ipc/health-handlers.test.ts`:

```typescript
it('checks health for agents array instead of single codingAgent', async () => {
  mockDs.readSettings.mockResolvedValue({
    agents: [
      { id: 'agent_1', type: 'claude-code', name: 'Claude', icon: 'claude-code', defaultCommand: 'claude', snippets: [] }
    ],
    activeAgentId: 'agent_1'
  })

  const handler = handlers.get('health:check')!
  const result = (await handler()) as HealthCheckResult

  expect(result.agentHarnessConfigured).toBe(true)
})

it('reports no agent harness when agents array is empty', async () => {
  mockDs.readSettings.mockResolvedValue({ agents: [] })

  const handler = handlers.get('health:check')!
  const result = (await handler()) as HealthCheckResult

  expect(result.agentHarnessConfigured).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/ipc/health-handlers.test.ts -t "agents array" --reporter=verbose 2>&1 | tail -20`
Expected: FAIL

- [ ] **Step 3: Update health check handler**

In `src/main/ipc/health-handlers.ts`, update the `health:check` handler (around line 328):

```typescript
// Determine effective agent type(s)
const agents = settings.agents ?? []
const effectiveAgent = overrideAgent || (agents.length > 0 ? agents[0].type : settings.codingAgent)

// 2. Check agent harness
const agentHarnessConfigured = agents.length > 0 || !!settings.codingAgent
```

Update the `health:fix-all` handler (around line 452) similarly:

```typescript
const agents = settings.agents ?? []
const hasClaudeAgent = agents.some((a) => a.type === 'claude-code') || settings.codingAgent === 'claude-code'

if (hasClaudeAgent) {
  // ... existing claude-code fix logic
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/ipc/health-handlers.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/health-handlers.ts src/main/ipc/health-handlers.test.ts
git commit -m "feat: update health checks to use agents array"
```

---

### Task 12: Update CLI agents command

**Files:**
- Modify: `src/cli/commands/agents.ts:12-56`

- [ ] **Step 1: Update buildSettingsSection to use agents array**

In `src/cli/commands/agents.ts`, update the `buildSettingsSection` function to read from `settings.agents` instead of `settings.codingAgent`:

```typescript
function buildSettingsSection(settings: ProjectSettings): string {
  const agents = settings.agents ?? []
  const activeId = settings.activeAgentId

  if (agents.length === 0 && settings.codingAgent) {
    // Legacy fallback
    return `\n\n## Active Settings\n\n- **Agent**: ${settings.codingAgent}\n- **Simplify Titles**: ${settings.simplifyTaskTitles ? 'ON' : 'OFF'}\n`
  }

  if (agents.length === 0) {
    return '\n\n## Active Settings\n\n- **No agents configured**\n'
  }

  const lines = ['\n\n## Active Settings\n']
  lines.push(`- **Simplify Titles**: ${settings.simplifyTaskTitles ? 'ON' : 'OFF'}`)
  lines.push(`\n### Configured Agents\n`)
  for (const agent of agents) {
    const active = agent.id === activeId ? ' **(active)**' : ''
    lines.push(`- ${agent.name} (${agent.type})${active}`)
  }
  return lines.join('\n') + '\n'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/agents.ts
git commit -m "feat: update CLI agents command for multi-agent profiles"
```

---

### Task 13: Run full test suite and fix issues

**Files:**
- Various test files

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -50`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `npm test 2>&1 | tail -40`
Expected: All tests pass. Fix any failures.

- [ ] **Step 3: Fix any test failures**

Update test mocks and assertions that reference the old `codingAgent` field to also work with the new `agents` array. Key test files to check:
- `src/renderer/src/components/onboarding/Onboarding.test.tsx`
- `src/renderer/src/components/board/KanbanBoard.test.tsx`
- `src/renderer/src/components/command-palette/CommandPalette.test.tsx`
- `src/renderer/src/components/settings/SettingsPage.test.tsx`
- `src/main/ipc/health-handlers.test.ts`
- `src/renderer/src/stores/project-switching.test.ts`

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "test: fix existing tests for multi-agent profiles"
```

---

### Task 14: Final integration test

**Files:**
- No new files — manual verification

- [ ] **Step 1: Run full test suite one more time**

Run: `npm test 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 2: Run typecheck one more time**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: multi-agent profiles feature complete"
```
