# Multi-Agent Profiles Design

Replace the single `codingAgent` setting with an array of agent profiles, each carrying its own default command, snippets, and icon. A quick-switch select in the create task area lets users pick which agent runs for new tasks.

## Data Model

### AgentProfile (`src/shared/types/settings.ts`)

```ts
interface AgentProfile {
  id: string              // generated unique ID, e.g. "agent_abc123"
  type: 'claude-code' | 'codex' | 'other'
  name: string            // "Claude Code", "Codex", or custom
  icon: string            // 'claude-code' | 'codex' for known types, lucide icon name for 'other'
  defaultCommand: string  // shell command for new task terminals
  snippets: Snippet[]     // auto-run snippets for this agent
}
```

### ProjectSettings changes

```ts
// New fields
agents?: AgentProfile[]      // all configured agent profiles
activeAgentId?: string       // ID of currently selected agent for new tasks

// Deprecated (kept for migration, ignored going forward)
codingAgent?: CodingAgent
```

### Task stamping

Add `agentId?: string` to the `Task` type. Set to `activeAgentId` at task creation time. The task's terminal uses that agent's `defaultCommand` and `snippets`.

## Icons

- **Claude Code**: inline SVG of the Claude symbol mark (#D97757 orange). Hard-coded, not user-changeable.
- **Codex (OpenAI)**: inline SVG of the OpenAI knot/flower symbol (currentColor). Hard-coded, not user-changeable.
- **Other**: user selects from the Lucide icon library via a searchable picker.

SVG sources (public domain, from lobehub/lobe-icons npm CDN):
- Claude: `@lobehub/icons-static-svg` claude-color.svg
- OpenAI: `@lobehub/icons-static-svg` openai.svg

Stored as React components in `src/renderer/src/components/common/AgentIcons.tsx`.

## Settings Page UI

Replace the single "Agent Harness" dropdown with a card-based management section titled "CODING AGENTS":

### Agent cards list

Each configured agent shows as a card with:
- Brand icon (Claude/OpenAI SVG) or Lucide icon (for "other")
- Name
- Default command preview (truncated)
- Edit / Delete buttons
- An "active" indicator for the currently selected agent

### Add Agent flow

An "Add Agent" button opens an inline form:
- **Type selector**: Claude Code | Codex | Other
- Selecting Claude Code or Codex auto-fills name, icon, and a sensible default command
- Selecting "Other" shows: name field, Lucide icon picker, command field
- Snippets configuration per agent

### Edit mode

Clicking edit on an existing card lets the user change name, command, and snippets. For known types (Claude Code, Codex), the icon stays locked. For "other", the icon is editable.

## Quick-Switch Select in Create Task Area

### Placement

In the footer area of `CreateTaskInput`, on the left side before "Enter to create". A small select box showing the active agent's icon + name.

### Behavior

- Shows all configured agents from `settings.agents[]`
- Displays the brand SVG icon inline in each option (or Lucide icon for "other")
- Defaults to `settings.activeAgentId`
- Changing the selection updates `activeAgentId` in settings (persisted)
- When a task is created, the current `activeAgentId` is stamped onto the task as `task.agentId`
- The task's terminal uses that agent's `defaultCommand` and `snippets`

### Edge cases

- **One agent configured**: show select with one option (keeps UI consistent and discoverable)
- **No agents configured**: show a warning icon with tooltip "No agents configured - go to Settings"

## Task & Terminal Integration

1. **Task creation**: `addTask` stamps `agentId` from the current `activeAgentId`
2. **Terminal startup**: `ElectronPtyManager.create()` currently receives `taskId` and resolves `defaultCommand` from `settings.defaultCommand` (line ~323). Change: after reading the task's `agentId`, read `settings.agents[]` to find the matching profile and use its `defaultCommand`. The PTY manager already has access to settings via the data service — the additional step is reading the task JSON to get `agentId`, then looking up the agent profile.
3. **Snippets**: snippet toggles in create task input and terminal panel show the active agent's snippets. `CreateTaskInput` receives agent data as props from `KanbanColumn` (which gets it from `KanbanBoard`). `KanbanBoard` reads settings and passes the active agent's snippets down as `allSnippets`.
4. **Fallback**: if `task.agentId` references a deleted agent or is missing, fall back to the global `defaultCommand` and `snippets`

### Backward compatibility

- The global `defaultCommand` and `snippets` in `ProjectSettings` remain as fallbacks
- Each `AgentProfile` overrides them for tasks created while that agent is active
- Existing tasks without `agentId` continue working unchanged

## Migration

On settings load, if the old `codingAgent` field exists but `agents` array is empty/missing:

1. Auto-create an `AgentProfile` from the old data:
   - `type`: value of `codingAgent` (e.g., `'claude-code'`)
   - `name`: from `CODING_AGENT_LABELS[codingAgent]`
   - `icon`: `'claude-code'` or `'codex'` for known types
   - `defaultCommand`: from `settings.defaultCommand`
   - `snippets`: from `settings.snippets`
2. Set it as `activeAgentId`
3. Old `codingAgent` field left in place but ignored going forward

**Onboarding**: the "Select Your Coding Agent" step creates the first `AgentProfile` entry instead of setting the old `codingAgent` string.

## Health Checks

The current health handler (`health-handlers.ts`) only has a `claude-code` branch. With multi-agent:

- **`health:check`**: iterate `settings.agents[]`. For each agent by type:
  - `claude-code`: check claude binary, hooks, skill (existing logic)
  - `codex`: check `codex` binary availability. No hooks/skill checks (Codex uses AGENTS.md, not `.claude/hooks/`)
  - `other`: no agent-specific checks (just CLI availability)
- **`health:fix-all`**: iterate agents array instead of checking single `settings.codingAgent`. Apply fixes per agent type.
- **Override agent during onboarding**: the `overrideAgent` parameter becomes `overrideAgentType` to match the new model.

## Agent Default Commands

Known agent types auto-fill these defaults:

- **Claude Code**: `claude --allow-dangerously-skip-permissions --permission-mode bypassPermissions --resume $FAMILIAR_TASK_ID`
- **Codex**: `codex --full-auto`
- **Other**: empty (user must fill in)

## CLI Impact

The CLI (`src/cli/`) reads `.familiar/settings.json` directly. Changes needed:

- `familiar agents` command: should read from `settings.agents[]` instead of `settings.codingAgent`
- The CLI does not need to know `activeAgentId` — that's a renderer concern
- No other CLI commands reference agent config directly

## Validation

- Agent `id` values are generated with the existing `generateId('agent')` pattern
- Agent names do not need to be unique (users may want "Claude Code (fast)" and "Claude Code (thorough)")
- Deleting the active agent resets `activeAgentId` to the first remaining agent, or `undefined` if none left

## Scope — only new tasks affected

Switching agents only affects tasks created from that point forward. Existing tasks keep whatever agent they were created with.

## Files Changed

### Types & Data
- `src/shared/types/settings.ts` — Add `AgentProfile` interface, `agents`/`activeAgentId` to `ProjectSettings`
- `src/shared/types/task.ts` — Add `agentId?: string` to `Task`

### New Files
- `src/renderer/src/components/common/AgentIcons.tsx` — Claude & OpenAI brand SVG components + Lucide icon renderer

### Settings Page
- `src/renderer/src/components/settings/SettingsPage.tsx` — Replace dropdown with agent cards, add/edit/delete UI, Lucide icon picker for "other"

### Create Task
- `src/renderer/src/components/common/CreateTaskInput.tsx` — Add agent select dropdown in footer

### Terminal Integration
- `src/main/platform/electron-pty.ts` — Resolve `defaultCommand` from agent profile via `task.agentId`
- `src/renderer/src/components/board/KanbanBoard.tsx` — Pass active agent's snippets to columns

### Onboarding
- `src/renderer/src/components/onboarding/Onboarding.tsx` — Create `AgentProfile` instead of setting `codingAgent`

### Health Checks
- `src/main/ipc/health-handlers.ts` — Check agents array instead of single `codingAgent`

### Migration
- `src/main/services/data-service.ts` — Auto-migrate old `codingAgent` to `agents[]` on load

### CLI
- `src/cli/commands/agents.ts` — Read from `settings.agents[]`

### Tests
- Colocated tests for all changed files
