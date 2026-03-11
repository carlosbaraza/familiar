# Kanban Agent — Product Requirements Document

## Overview

Kanban Agent is a macOS Electron desktop application that provides a Linear-style kanban board with embedded terminal emulators, purpose-built for agentic AI coding workflows. Each task card can have its own rich block editor and one or more terminal panes running persistent tmux sessions. A companion CLI (`kanban-agent`) allows agents and scripts to create/update tasks, log activity, and send notifications without the GUI.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌───────┐│
│  │ node-pty  │  │  File I/O │  │ tmux mgr   │  │ IPC   ││
│  │ (PTY mgr) │  │ (data)    │  │ (sessions) │  │bridge ││
│  └──────────┘  └──────────┘  └────────────┘  └───────┘│
└───────────────────────┬─────────────────────────────────┘
                        │ IPC (contextBridge)
┌───────────────────────▼─────────────────────────────────┐
│                  Renderer Process (React)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │ Kanban   │  │ Task     │  │ Block    │  │ xterm.js││
│  │ Board    │  │ Detail   │  │ Editor   │  │ Terminal││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘│
│                  ┌──────────┐                           │
│                  │ Zustand  │                           │
│                  │ Store    │                           │
│                  └──────────┘                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     CLI (kanban-agent)                    │
│  Reads/writes .kanban-agent/ directly, sends IPC notify  │
└─────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Platform abstraction layer** — All Electron-specific APIs (file I/O, PTY, notifications, window management) are accessed through TypeScript interfaces in `src/shared/platform/`. The Electron implementation lives in `src/main/platform/`. This allows a future browser implementation to swap in WebSocket-based file I/O and remote PTY.

2. **Zustand store in renderer only** — State lives in the renderer process via Zustand. The main process does not hold application state; it provides services (file I/O, PTY, tmux) via IPC handlers.

3. **File-based persistence** — The `.kanban-agent/` folder is the single source of truth. The Zustand store hydrates from disk on startup and persists on mutations (debounced writes). No database.

4. **tmux as session manager** — Terminal sessions use real tmux sessions. The app creates/attaches tmux sessions named `kanban-<taskid>-<pane>`. This gives persistence across app restarts for free.

---

## Project Structure

```
kanban-agent/
├── src/
│   ├── main/                          # Electron main process
│   │   ├── index.ts                   # App entry, window creation
│   │   ├── ipc/                       # IPC handler registrations
│   │   │   ├── file-handlers.ts
│   │   │   ├── pty-handlers.ts
│   │   │   ├── tmux-handlers.ts
│   │   │   ├── notification-handlers.ts
│   │   │   └── window-handlers.ts
│   │   ├── services/
│   │   │   ├── data-service.ts        # Data access layer
│   │   │   └── file-watcher.ts        # External change detection
│   │   └── platform/                  # Electron implementations
│   │       ├── electron-file-system.ts
│   │       ├── electron-pty.ts
│   │       ├── electron-tmux.ts
│   │       └── electron-notifications.ts
│   ├── preload/
│   │   └── index.ts                   # contextBridge exposing IPC APIs
│   ├── renderer/
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx               # React entry
│   │   │   ├── components/
│   │   │   │   ├── board/             # Kanban board components
│   │   │   │   ├── task-detail/       # Task detail view components
│   │   │   │   ├── editor/            # Block editor wrapper
│   │   │   │   ├── terminal/          # xterm.js terminal components
│   │   │   │   ├── command-palette/   # Cmd+K palette
│   │   │   │   ├── layout/            # App shell, sidebar, panels
│   │   │   │   └── common/            # Shared UI components
│   │   │   ├── stores/                # Zustand stores
│   │   │   │   ├── task-store.ts
│   │   │   │   ├── board-store.ts
│   │   │   │   ├── terminal-store.ts
│   │   │   │   └── ui-store.ts
│   │   │   ├── hooks/                 # Custom React hooks
│   │   │   ├── styles/                # Global styles, theme tokens
│   │   │   └── lib/                   # Utilities, helpers
│   │   └── ...
│   ├── shared/                        # Shared between main, renderer, CLI
│   │   ├── types/                     # TypeScript types/interfaces
│   │   │   ├── task.ts
│   │   │   ├── board.ts
│   │   │   ├── activity.ts
│   │   │   └── terminal.ts
│   │   ├── platform/                  # Platform abstraction interfaces
│   │   │   ├── file-system.ts
│   │   │   ├── pty.ts
│   │   │   ├── tmux.ts
│   │   │   └── notifications.ts
│   │   ├── constants.ts
│   │   └── utils/
│   │       ├── id-generator.ts
│   │       ├── task-utils.ts
│   │       └── validators.ts
│   └── cli/                           # CLI tool
│       ├── index.ts                   # Entry point (bin)
│       ├── commands/
│       │   ├── init.ts
│       │   ├── add.ts
│       │   ├── list.ts
│       │   ├── status.ts
│       │   ├── update.ts
│       │   ├── delete.ts
│       │   ├── log.ts
│       │   ├── notify.ts
│       │   ├── open.ts
│       │   ├── sync.ts
│       │   └── import.ts
│       └── lib/
│           ├── file-ops.ts            # Direct file system operations
│           └── ipc-client.ts          # Communicate with running app
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── playwright.config.ts
└── tests/
    ├── e2e/
    └── unit/
```

---

## Data Model

### File Structure (`.kanban-agent/`)

```
.kanban-agent/
├── state.json                    # Project state (task list, ordering)
└── tasks/
    └── <taskid>/
        ├── task.json             # Task metadata
        ├── document.md           # Main task document (block editor)
        ├── activity.json         # Activity log entries
        └── attachments/          # Images and files
```

### TypeScript Types

```typescript
type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done' | 'cancelled';
type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface Task {
  id: string;              // nanoid, e.g. "tsk_a1b2c3"
  title: string;
  status: TaskStatus;
  priority: Priority;
  labels: string[];
  agentStatus: AgentStatus;
  createdAt: string;       // ISO 8601
  updatedAt: string;
  sortOrder: number;       // within column
}

interface ProjectState {
  version: number;
  projectName: string;
  tasks: Task[];
  columnOrder: TaskStatus[];
  labels: string[];
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  type: 'status_change' | 'agent_event' | 'note' | 'created' | 'updated';
  message: string;
  metadata?: Record<string, unknown>;
}
```

---

## IPC Contract

The preload script exposes a typed `window.api` object:

```typescript
interface ElectronAPI {
  // File operations
  readProjectState(): Promise<ProjectState>;
  writeProjectState(state: ProjectState): Promise<void>;
  readTaskDocument(taskId: string): Promise<string>;
  writeTaskDocument(taskId: string, content: string): Promise<void>;
  readTaskActivity(taskId: string): Promise<ActivityEntry[]>;
  appendActivity(taskId: string, entry: ActivityEntry): Promise<void>;
  saveAttachment(taskId: string, fileName: string, data: ArrayBuffer): Promise<string>;

  // Terminal / PTY
  createPty(taskId: string, paneId: string, cwd: string): Promise<void>;
  writePty(sessionId: string, data: string): Promise<void>;
  resizePty(sessionId: string, cols: number, rows: number): Promise<void>;
  destroyPty(sessionId: string): Promise<void>;
  onPtyData(callback: (sessionId: string, data: string) => void): () => void;

  // Tmux
  listTmuxSessions(): Promise<string[]>;
  attachTmuxSession(sessionName: string): Promise<void>;
  detachTmuxSession(sessionName: string): Promise<void>;

  // Notifications
  sendNotification(title: string, body: string): Promise<void>;

  // Window
  onExternalTaskOpen(callback: (taskId: string) => void): () => void;

  // File watching
  watchProjectDir(callback: () => void): () => void;
  unwatchProjectDir(): void;
}
```

---

## Feature Specifications

### F1: Kanban Board

- **Columns**: Backlog, Todo, In Progress, In Review, Done, Cancelled
- **Drag-and-drop**: Between columns (status change) and within columns (reorder) using `@dnd-kit`
- **Task cards** show: title, priority indicator (colored icon), labels (badges), agent status indicator (animated dot)
- **Inline creation**: Input field appears at top of column, Enter to create, Escape to cancel
- **Filtering**: Text search + priority filter + label filter + agent status filter (AND logic, client-side)
- **Keyboard navigation**: j/k (up/down), h/l (between columns), Enter (open), x (select), c (create), 1-4 (priority), Backspace (delete with confirm)

### F2: Task Detail View

- **Open animation**: Card smoothly expands to fill view (framer-motion)
- **Default layout**: Block editor LEFT, terminal RIGHT (resizable split panel)
- **Flexible panels**: User can drag to rearrange panel positions
- **Header**: Editable title, status dropdown, priority selector, labels editor, timestamps
- **Close**: Escape or click outside

### F3: Block Editor

- **Library**: BlockNote (or TipTap) with Yjs backend for CRDT-readiness
- **Features**: Headings, paragraphs, lists, code blocks, checkboxes, dividers, slash commands
- **Images**: Paste (Cmd+V) or drag-and-drop to embed. Saved to `tasks/<id>/attachments/`. Displayed inline.
- **Persistence**: Debounced save (1s) to `document.md`. Store BlockNote JSON alongside for lossless round-tripping.
- **Storage**: All attachments in `tasks/<taskid>/attachments/`

### F4: Terminal Integration

- **Backend**: Real tmux sessions (requires tmux installed)
- **Rendering**: xterm.js with WebGL renderer, fit addon for auto-resize
- **Session naming**: `kanban-<taskId>-<paneIndex>`
- **Multiple panes**: Tab bar above terminal area, "+" button to add new pane
- **Persistence**: Sessions survive app restarts via tmux detach/reattach
- **Agent-agnostic**: Any CLI command can be spawned
- **Manual launch**: No auto-start, user starts commands manually

### F5: Activity Timeline

- **Types**: Status changes (from/to), agent events, human notes, creation
- **Display**: Chronological, relative timestamps ("2h ago"), icon per type
- **Input**: Free text note input at bottom
- **Storage**: `activity.json` in task folder

### F6: Command Palette (Cmd+K)

- **Library**: cmdk
- **Sections**: Tasks (search by title), Actions (create, change view), Navigation (columns)
- **Fuzzy search** across task titles
- **Linear-style styling**: Dark modal, subtle borders, monospace hints
- **Keyboard**: Up/down navigate, Enter select

### F7: CLI (`kanban-agent`)

- **Library**: Commander.js
- **Commands**:
  - `init` — Create `.kanban-agent/` directory structure
  - `add <title>` — Create task with generated ID
  - `list` — Print tasks table (ID, title, status, priority)
  - `status <id> <status>` — Update task status, log activity
  - `update <id> [--title] [--priority] [--labels]` — Update task fields
  - `delete <id>` — Remove task
  - `log <id> <message>` — Append to activity log
  - `notify <id>` — Send macOS notification
  - `open [id]` — Launch app, optionally to specific task
  - `sync` — Future: push/pull state
  - `import <file>` — Parse markdown spec into tasks
- **Standalone**: CLI reads/writes `.kanban-agent/` directly (no Electron dependency)
- **Build**: esbuild/tsup to standalone Node.js script

### F8: Notifications

- OS native macOS notifications via Electron `Notification` API
- Optional system sound
- Triggered by: CLI `notify` command, agent status change to "done"

### F9: File Watching

- Watch `.kanban-agent/` for external changes (CLI writes)
- Chokidar in main process, emit to renderer via IPC
- Renderer re-reads state and reconciles Zustand store
- Debounced, ignore self-triggered changes

### F10: Theme & Design

- **Aesthetic**: Linear-clone — dark mode, clean lines, Inter font, muted colors
- **Colors**: Dark palette matching Linear's dark theme
- **Typography**: Inter for UI, monospace for terminal/code
- **Animations**: Fast (150-250ms), eased, respect `prefers-reduced-motion`
- **Components**: Button, Input, Badge, IconButton as base primitives

---

## Task Tree

### Phase 0: Project Scaffolding

| ID | Title | Dependencies | Est. Hours |
|----|-------|-------------|-----------|
| **T-001** | Initialize electron-vite project with React + TypeScript | None | 2 |
| **T-002** | Define shared TypeScript types and constants | None | 2 |
| **T-003** | Define platform abstraction interfaces | T-002 | 2 |
| **T-004** | Set up CSS/styling foundation with Linear-clone theme | T-001 | 3 |
| **T-005** | Set up testing infrastructure (Vitest + Playwright) | T-001 | 3 |

### Phase 1: Data Layer and IPC

| ID | Title | Dependencies | Est. Hours |
|----|-------|-------------|-----------|
| **T-010** | Implement Electron file system service | T-003 | 3 |
| **T-011** | Implement data access layer (project state CRUD) | T-010, T-002 | 4 |
| **T-012** | Set up IPC bridge and preload script | T-011, T-001 | 3 |
| **T-013** | Implement Zustand task store with persistence | T-012, T-002 | 4 |
| **T-014** | Implement Zustand UI store | T-001 | 1 |

### Phase 2: Kanban Board UI

| ID | Title | Dependencies | Est. Hours |
|----|-------|-------------|-----------|
| **T-020** | Build app shell layout | T-004, T-014 | 3 |
| **T-021** | Build kanban column component | T-004 | 2 |
| **T-022** | Build task card component | T-004, T-002 | 2 |
| **T-023** | Implement drag-and-drop with @dnd-kit | T-021, T-022, T-013 | 4 |
| **T-024** | Implement keyboard navigation on board | T-023, T-014 | 3 |
| **T-025** | Build new task creation flow | T-013, T-021 | 2 |
| **T-026** | Implement board filtering and search | T-013, T-014, T-004 | 3 |

### Phase 3: Task Detail View

| ID | Title | Dependencies | Est. Hours |
|----|-------|-------------|-----------|
| **T-030** | Build task detail panel with expand animation | T-020, T-013, T-004 | 4 |
| **T-031** | Integrate BlockNote block editor with Yjs | T-030, T-012 | 4 |
| **T-032** | Implement image paste/drag in editor | T-031, T-012 | 3 |
| **T-033** | Build activity timeline component | T-030, T-012 | 3 |
| **T-034** | Implement split-panel layout in task detail | T-030 | 3 |

### Phase 4: Terminal Integration

| ID | Title | Dependencies | Est. Hours |
|----|-------|-------------|-----------|
| **T-040** | Implement tmux manager in main process | T-003 | 3 |
| **T-041** | Implement PTY manager in main process (node-pty) | T-040, T-003 | 4 |
| **T-042** | Build xterm.js terminal component | T-041, T-012 | 4 |
| **T-043** | Implement Zustand terminal store | T-042, T-040 | 2 |
| **T-044** | Integrate terminal panes into task detail | T-042, T-043, T-034 | 3 |
| **T-045** | Add IPC handlers for tmux and PTY | T-041, T-040, T-012 | 2 |

### Phase 5: Command Palette and Shortcuts

| ID | Title | Dependencies | Est. Hours |
|----|-------|-------------|-----------|
| **T-050** | Build Cmd+K command palette (cmdk) | T-013, T-014, T-004 | 4 |
| **T-051** | Implement global keyboard shortcut system | T-024, T-050 | 3 |

### Phase 6: CLI Tool

| ID | Title | Dependencies | Est. Hours |
|----|-------|-------------|-----------|
| **T-060** | Set up CLI scaffolding with Commander.js | T-002 | 3 |
| **T-061** | Implement core CLI commands: init, add, list, status, delete | T-060 | 4 |
| **T-062** | Implement extended CLI commands: update, log, notify, open | T-061 | 3 |
| **T-063** | Implement CLI import command (markdown spec parser) | T-061 | 3 |

### Phase 7: Notifications and File Watching

| ID | Title | Dependencies | Est. Hours |
|----|-------|-------------|-----------|
| **T-070** | Implement native macOS notifications | T-003, T-012 | 2 |
| **T-071** | Implement file watcher for external changes | T-010, T-013 | 3 |

### Phase 8: Polish and UX

| ID | Title | Dependencies | Est. Hours |
|----|-------|-------------|-----------|
| **T-080** | Add animations and transitions (framer-motion) | T-023, T-030, T-050 | 3 |
| **T-081** | Implement context menus | T-022, T-044 | 3 |
| **T-082** | Add empty states and loading states | T-023, T-030 | 2 |
| **T-083** | Implement agent status indicator system | T-042, T-013 | 3 |

### Phase 9: Testing

| ID | Title | Dependencies | Est. Hours |
|----|-------|-------------|-----------|
| **T-090** | Unit tests for data layer and stores | T-013, T-043, T-005 | 4 |
| **T-091** | Unit tests for CLI commands | T-061, T-062, T-063, T-005 | 3 |
| **T-092** | E2E tests for kanban board | T-023, T-030, T-050, T-005 | 4 |
| **T-093** | E2E tests for terminal integration | T-044, T-005 | 3 |
| **T-094** | E2E tests for CLI | T-061, T-005 | 2 |

---

## Dependency Graph — Parallelization Waves

Tasks grouped by when they can start (all tasks in a wave can run in parallel):

```
Wave 1:  T-001, T-002, T-005
Wave 2:  T-003, T-004, T-014, T-060
Wave 3:  T-010, T-040, T-061
Wave 4:  T-011, T-041, T-062, T-063
Wave 5:  T-012, T-045
Wave 6:  T-013, T-042, T-070, T-071
Wave 7:  T-020, T-021, T-022, T-043, T-050, T-026
Wave 8:  T-023, T-025, T-030, T-033, T-034, T-044
Wave 9:  T-024, T-031, T-080, T-081, T-082, T-083
Wave 10: T-032, T-051
Wave 11: T-090, T-091, T-092, T-093, T-094
```

### Visual Dependency Graph

```
T-001 ──┬── T-004 ──┬── T-020 ──── T-030 ──┬── T-031 ── T-032
        │           │                       ├── T-033
        │           │                       └── T-034 ── T-044
        │           ├── T-021 ──┐
        │           └── T-022 ──┼── T-023 ── T-024 ── T-051
        │                       │
        ├── T-014 ──────────────┤
        │                       │
        └── T-005 ──────────────┼── T-090, T-092, T-093, T-094
                                │
T-002 ──┬── T-003 ──┬── T-010 ──┼── T-011 ── T-012 ── T-013
        │           │           │
        │           ├── T-040 ──┼── T-041 ── T-042 ── T-043
        │           │           │
        │           └── T-070   └── T-045
        │
        └── T-060 ── T-061 ──┬── T-062
                             ├── T-063
                             ├── T-091
                             └── T-094
```

### Critical Path

Longest sequential dependency chain: **~29 hours**

```
T-002 (2h) → T-003 (2h) → T-010 (3h) → T-011 (4h) → T-012 (3h)
→ T-013 (4h) → T-030 (4h) → T-031 (4h) → T-032 (3h)
```

With 4 parallel agents: estimated **35-45 hours** wall-clock time.

---

## Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| `node-pty` native module build issues with electron-vite | Blocks terminal feature | Use `electron-rebuild` in postinstall. Pin known-good version. Test early (T-041). |
| BlockNote markdown round-tripping | Lossy conversion corrupts documents | Store BlockNote JSON alongside markdown. Markdown is derived for readability. |
| tmux not installed on user machine | Terminal feature broken | Check on startup, show clear error with install instructions. |
| File watcher race conditions | CLI + app write simultaneously | Atomic writes (temp then rename). Debounce watcher reads. |
| @dnd-kit performance with many tasks | Janky drag | Virtualize columns if >100 tasks per column. |

---

## Total Estimates

| Phase | Tasks | Total Hours |
|-------|-------|-------------|
| Phase 0: Scaffolding | 5 | 12 |
| Phase 1: Data Layer | 5 | 15 |
| Phase 2: Board UI | 7 | 19 |
| Phase 3: Detail View | 5 | 17 |
| Phase 4: Terminal | 6 | 18 |
| Phase 5: Cmd Palette | 2 | 7 |
| Phase 6: CLI | 4 | 13 |
| Phase 7: Notifications | 2 | 5 |
| Phase 8: Polish | 4 | 11 |
| Phase 9: Testing | 5 | 16 |
| **Total** | **45 tasks** | **~133 hours** |
