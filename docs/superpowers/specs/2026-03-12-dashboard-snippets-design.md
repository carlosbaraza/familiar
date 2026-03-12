# Dashboard Snippets — Design Spec

## Summary

Allow snippets to appear as action buttons on TaskCards in the kanban board, so users can fire commands (e.g., "Start agent") directly from the dashboard without opening a task. Requires background tmux session warmup on task creation and an icon system for snippet buttons.

## Scope

1. **Snippet type extensions** — icon, dashboard visibility, display mode fields
2. **Icon picker** — searchable Lucide icon picker in snippet settings modal
3. **Snippet settings modal updates** — icon picker integration + per-snippet "Advanced" collapsible with visibility toggles
4. **TaskCard footer** — unified footer row with snippet buttons (left) and labels (right)
5. **Tmux session warmup** — silently create tmux sessions on task creation (all columns except archived)
6. **Block task creation in Archived column**
7. **Dashboard snippet execution** — send commands to pre-warmed tmux sessions from TaskCard buttons

## Data Model Changes

### Snippet interface (`src/shared/types/settings.ts`)

```typescript
export interface Snippet {
  title: string
  command: string
  pressEnter: boolean
  /** Lucide icon name (e.g., "play", "rocket"). undefined = no icon */
  icon?: string
  /** Show this snippet as a button on TaskCards in the board. Default: false */
  showInDashboard?: boolean
  /** When shown in dashboard, display only the icon (no text label). Default: false */
  showIconInDashboard?: boolean
  /** When shown in terminal bar, display only the icon (no text label). Default: false */
  showIconInTerminal?: boolean
}
```

No changes to `Task` or `ProjectState` types. All snippet config lives in `ProjectSettings`.

## Component Changes

### 1. TaskCard Footer (`src/renderer/src/components/board/TaskCard.tsx`)

**Rendering logic:**
- Compute `dashboardSnippets` = snippets where `showInDashboard === true`
- `showFooter` = `dashboardSnippets.length > 0 || task.labels.length > 0`
- If `!showFooter`: no footer row, just agent dot + title
- If footer: border-top separator, snippet buttons left, labels right (with flex spacer between)

**Snippet button rendering:**
- If snippet has `icon` and `showIconInDashboard`: render icon-only button (24x22px square)
- If snippet has `icon` and `!showIconInDashboard`: render icon + text label
- If snippet has no `icon`: render text-only button
- First dashboard snippet gets accent styling (indigo border/bg), subsequent snippets get subtle styling
- All snippet buttons call `e.stopPropagation()` to avoid opening the task detail

**Snippet execution from dashboard:**
- On click, send command to the task's tmux session via `window.api.tmuxSendKeys(sessionName, command, pressEnter)`
- Session name follows existing convention: `kanban-<taskId>`
- This intentionally uses `tmux send-keys` directly (not PTY write) because no PTY session exists at dashboard level — only the raw tmux session created during warmup
- The IPC handler calls `tmux send-keys -t <session> <command>` and conditionally appends the tmux key name `Enter` (not `\r`) when `pressEnter` is true, matching tmux send-keys conventions

**Snippets data source:**
- TaskCard needs access to project settings (snippets). Load once at board level, pass down as prop or via a lightweight settings store/context.

### 2. Snippet Settings Modal (`src/renderer/src/components/terminal/SnippetSettingsModal.tsx`)

**Main row per snippet (horizontal):**
1. Icon picker button (left) — shows selected icon chip or "+ Icon" placeholder
2. Label text input
3. Command text input (flex: 2)
4. Auto-run checkbox
5. Remove button (×)

**Icon picker button states:**
- **No icon selected**: dashed border, shows "+ Icon" text, click opens picker popover
- **Icon selected**: solid accent border, shows Lucide icon + name text + × clear button. Click reopens picker. × clears icon.

**Advanced section (collapsible per snippet):**
- Collapsed by default, shows "▸ Advanced" toggle
- Expanded shows "▾ Advanced" with three checkboxes:
  - "Show in dashboard" (default: unchecked)
  - "Icon only in dashboard" (default: unchecked, only meaningful when icon is set and showInDashboard is true)
  - "Icon only in terminal" (default: unchecked, only meaningful when icon is set)

### 3. Icon Picker Component (`src/renderer/src/components/terminal/IconPicker.tsx`)

New component — searchable popover for selecting Lucide icons.

**Behavior:**
- Opens as a positioned popover below the icon button
- Search input at top, auto-focused
- Grid of icon buttons (6 columns) showing matching Lucide icons
- Icons filtered by name against search query
- Selected icon highlighted with accent background
- Click an icon → calls `onSelect(iconName)` → popover closes
- Match count shown below grid
- Click outside or Escape closes popover

**Icon loading strategy:**
- Use the `icons` export from `lucide-react` which is a `Record<string, LucideIcon>` map of all icons. This allows both the picker grid (iterate/filter over all icon names) and rendering by name (look up from the map).
- The picker grid filters icons client-side by matching the search query against icon names.
- Store only the string icon name (e.g., `"play"`, `"rocket"`) in settings JSON.
- For rendering a stored icon name in TaskCard or TerminalPanel, look up from the `icons` map and render the component. If the name doesn't resolve (e.g., icon was removed from lucide), fall back to no icon.

### 4. Terminal Panel Snippet Bar (`src/renderer/src/components/terminal/TerminalPanel.tsx`)

Update snippet button rendering to support icons:
- If snippet has `icon` and `showIconInTerminal`: render icon-only button
- If snippet has `icon` and `!showIconInTerminal`: render icon + text label
- If no `icon`: render text-only (current behavior)

### 5. Tmux Session Warmup

**On task creation** (`src/renderer/src/stores/task-store.ts` → `addTask`):

After creating task files, fire-and-forget a tmux warmup:
1. Call a new IPC method `window.api.warmupTmuxSession(taskId)` (no await needed in the UI flow)
2. Main process handler (`src/main/ipc/tmux-handlers.ts`):
   - Get project root
   - Create tmux session: `tmux new-session -d -s kanban-<taskId> -c <projectRoot>`
   - Inject env vars: `KANBAN_TASK_ID`, `KANBAN_PROJECT_ROOT`
   - Clear screen
   - Read settings, if `defaultCommand` exists, send it via `tmux send-keys`
3. If session already exists (edge case), skip silently

**When user opens task detail:**
- `TerminalPanel` calls `ptyCreate()` which already checks `tmuxHas()` → attaches to existing session
- No behavior change needed — the session is already warm
- Note: the `ptyCreate` path in `electron-pty.ts` also sends `defaultCommand` on new sessions (lines 213-219). Since warmup already sent it and `isNewSession` will be `false` when the session pre-exists, the default command will NOT be double-sent. No code change needed for this.

### 6. Block Task Creation in Archived Column

In `KanbanColumn.tsx`, hide the "+" add task button when the column status is `'archived'`.

### 7. IPC Additions

**New IPC method:**
- `warmup-tmux-session` — takes `taskId`, creates tmux session in background with env vars and default command
- Register in `src/main/ipc/tmux-handlers.ts`
- Expose in `src/preload/index.ts` as `window.api.warmupTmuxSession(taskId: string)`
- Add type to `src/renderer/src/env.d.ts`

**New IPC method:**
- `tmux-send-keys` — takes `sessionName: string`, `keys: string`, and `pressEnter: boolean`
- Handler calls `ElectronTmuxManager.sendKeys(sessionName, keys)` but must be updated: the current `sendKeys` unconditionally appends `Enter`. Refactor to accept an optional `pressEnter` parameter so the `Enter` key name is only appended when `pressEnter` is true.
- Register in `src/main/ipc/tmux-handlers.ts`
- Expose in `src/preload/index.ts` as `window.api.tmuxSendKeys(sessionName: string, keys: string, pressEnter: boolean)`
- Add type to `src/renderer/src/env.d.ts`

## Dependencies

- **lucide-react** — add to `package.json` dependencies. Tree-shakeable, only imports what's used.

## Edge Cases

- **Snippet click on card with no tmux session** (session was killed or warmup failed): show a brief toast/notification that the session is unavailable, or silently recreate it
- **Archived tasks**: no warmup, no dashboard snippets, no terminal
- **No icon set + "icon only in dashboard" enabled**: ignore the toggle, show text label (the toggle only takes effect when an icon exists)
- **Many dashboard snippets**: cap at 4 visible in the footer row, overflow hidden. Users can configure which snippets show via the `showInDashboard` toggle.
- **Programmatic task creation with archived status** (e.g., CLI import): skip warmup if `status === 'archived'`
- **TaskCardOverlay** (drag overlay): does NOT show snippet buttons — keep the overlay simple with just title + labels as today

## Testing Strategy

- Unit tests for new `Snippet` fields and footer rendering logic
- Unit test for icon picker search filtering
- Integration test for tmux warmup on task creation
- Verify existing terminal attachment works with pre-warmed sessions
