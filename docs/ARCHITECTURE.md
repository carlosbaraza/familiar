# Architecture Overview

## Process Model

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
│                  │ Stores   │                           │
│                  └──────────┘                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     CLI (familiar)                    │
│  Reads/writes .familiar/ directly, sends IPC notify  │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

1. **User action** → React component → Zustand store action
2. **Store action** → `window.api.xxx()` (IPC to main process)
3. **Main process** → DataService → File system (atomic writes)
4. **File watcher** detects external changes → IPC to renderer → store reloads

## Platform Abstraction

All Electron-specific code is behind interfaces:

```
src/shared/platform/        → Interfaces (IFileSystem, IPtyManager, ITmuxManager, INotificationManager)
src/main/platform/          → Electron implementations
(future) src/browser/platform/ → WebSocket/HTTP implementations for browser version
```

## Terminal Architecture

1. **tmux** manages sessions (`familiar-<taskId>-<paneIndex>`)
2. **node-pty** spawns `tmux attach-session -t <name>` for each pane
3. **xterm.js** renders in the browser with WebGL acceleration
4. PTY data flows: tmux → node-pty → IPC → xterm.js
5. Sessions persist across app restarts (tmux stays alive)

## State Management

Four Zustand stores, each focused:
- **task-store**: ProjectState, task CRUD, persistence via IPC
- **board-store**: Drag-and-drop transient state
- **ui-store**: Sidebar, filters, command palette, keyboard focus, panel sizes
- **terminal-store**: Terminal sessions and panes per task
