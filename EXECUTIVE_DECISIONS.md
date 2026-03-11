# Executive Decisions — Kanban Agent

Raw record of all architectural and product decisions made during the requirements gathering session. These are critical constraints that must be respected in all future implementation work.

---

## Original User Prompt

> I want to investigate and find the best open source electron apps that run a high performance terminal emulator inside. then I want to checkout the code to understand how they do that and create a new project inspired by it. The app would be an electron app that has the following principle. When I open a project folder, it creates a kanban view like a todo. each card represent an agentic unit of work. when a card is clicked, it zooms and opens a tmux session for that ticket which might have one or many agentic sessions like claude code running to complete the task. each task also has a markdown editor for the document's related to this task. the project tasks are stored in the .kanban-agent folder inside the project. there should be a main state file which tracks the status of the task. each task has a tasks/taskid folder where it stores all the plans, main document, etc. I want the ui and UX to be close to linear, simple task management with the twist of opening terminals directly inside the task. There should be also a CLI so that each task agent can autoupdate its own task status when it is finished. and also the agent should be able to send a notification via hooks when it finishes, so that you are informed of a task needing your attention.
>
> The whole app should be tested and e2e tested literally opening the app and testing it working.
>
> Ask me many questions to clarify the application and build a proper PRD that you need to store in this folder to serve as the base for all future implementations. I want it to be divided in multiple tickets for the chunks of work required, so that subagents can take each task and build them, so be aware of the dependencies between tasks and write a task tree so that the orchestrator agent can take each task to develop the app and parallelize when eneded creating more subagents until the work is finished.

---

## Q&A Session — Full Transcript

### Round 1: Core Architecture Questions

**Q: What frontend framework and language do you want for the Electron app?**

> 1. I want to use React, cause I know react and typescript strict.
> 3. Something simple instead of complex, not redux at all.
> 4. mostly typescript, but there could be touches of other languages if needed for performance. but bware that this will need to run in the browser at some point to manage remote agents.

(Numbers refer to the original question list: 1=Electron framework, 3=State management, 4=Language)

### Round 2: Terminal, Agents, Notifications, Platforms

**Q: How should terminal sessions work inside each task?**
> Actual tmux underneath (Recommended) — Spawn real tmux sessions per task. Sessions survive app restarts. Requires tmux installed. When browser version comes, tmux runs on remote server.

**Q: Should the app be agent-agnostic or have first-class Claude Code integration?**
> Agent-agnostic (Recommended) — Any CLI command can be spawned per task. Flexible for claude, aider, codex, custom scripts. Status updates via CLI tool only.

**Q: What notification channels when a task/agent finishes?**
> OS native + sound only — Simple macOS/Linux notifications with sound. No external deps. Good starting point.

**Q: Target platforms for the initial release?**
> macOS only (Recommended) — Ship faster. Add Linux/Windows later. Most AI dev tools start macOS-first.

### Round 3: Task Model, State, CLI, Editor

**Q: What kanban columns/statuses should tasks have?**
> Linear-style (Recommended) — Backlog, Todo, In Progress, In Review, Done, Cancelled. Familiar to Linear users. Clean and sufficient.

**Q: What should the .kanban-agent/ state file format be?**
> JSON files (Recommended) — Simple, human-readable, easy to diff in git. state.json + tasks/taskid/task.json. Works well with CLI tools.

**Q: What CLI commands should kanban-agent support beyond status updates?**
> Full CRUD + init + sync — Everything plus: init (create .kanban-agent/), sync (push/pull state), import (from Linear/GitHub issues).

**Q: How rich should the markdown editor be?**
> Initially answered "Monaco-based markdown", then corrected:

> actually I prefer a close to linear block editor for easier markdown visualiazation and potentially embedding pictures. all attachments and pictures would need to be stored in the same task folder.

### Round 4: Task Detail Layout, Drag-and-Drop, Card Fields, Command Palette

**Q: When a task card is clicked and zooms in, what layout should the task detail view have?**
> Flexible panels (drag to arrange) — User can drag/drop panels (editor, terminals, logs) into any arrangement. Most flexible, most complex.

User then added explicit default layout preference:

> by default when the task is opened, show the editor on the left for the main document and the terminal with tmux session on the right

**Q: Should the kanban board support drag-and-drop to change task status?**
> Yes, full drag-and-drop (Recommended) — Drag cards between columns to change status. Reorder within columns. Classic kanban UX like Linear/Trello.

**Q: What task properties should each card display on the board?**
> Title + status + priority + agent indicator — Show if an agent is running, priority level, and status badge. Clean and informative.

**Q: Should the app have a global terminal/command palette (Cmd+K) like Linear?**
> Yes, with search + actions (Recommended) — Cmd+K opens a palette to search tasks, run actions (create task, change status), navigate. Core Linear UX.

### Round 5: Projects, History, Theme, Hierarchy

**Q: How should the app handle multiple projects?**
> Single project (open folder) — Open a folder, see its kanban. Switch projects by opening a different folder. Like VS Code's workspace model.

**Q: Should the app persist terminal scrollback/history when switching between tasks?**
> Yes, via tmux (Recommended) — Since we're using tmux, sessions persist naturally. Switching tasks reattaches to that task's tmux session. Full history preserved.

**Q: What visual theme direction?**
> Linear-clone aesthetic (Recommended) — Dark mode, clean lines, Inter font, muted colors, smooth animations. Very close to Linear's look.

**Q: Should agents be able to create sub-tasks or is the task hierarchy flat?**
> Flat with labels/tags — No sub-tasks. Use labels/tags to group related tasks. Simpler data model. Can add hierarchy later.

### Round 6: Detection, Keyboard, Animation, Activity Log

**Q: How should the app detect that an agent has finished its work in a terminal?**
> CLI hook only (Recommended) — Agent calls `kanban-agent status <id> done` when finished. Simple, agent-agnostic. Agent must be configured to call this.

**Q: Should the initial version include keyboard shortcuts for power users?**
> Yes, Linear-style shortcuts (Recommended) — j/k to navigate, Enter to open, x to select, b for board view. Keyboard-first like Linear.

**Q: How should the zoom/transition animation work when clicking a task card?**
> Card expand animation (Recommended) — Card smoothly expands to fill the view, like Linear's issue open animation. Feels spatial and connected.

**Q: Should there be an activity log/timeline per task?**
> Yes, Linear-style activity feed (Recommended) — Chronological feed showing: status changes, agent start/stop, CLI commands received, human comments. Stored in task folder.

### Round 7: Editor Collaboration, Attachments, Build Tools, Auto-start

**Q: Should the block editor support real-time collaborative editing?**
> CRDT-ready for future collab — Use Yjs/CRDT backend from the start so collaborative editing can be added later without rewrite. Slightly more complex.

**Q: How should images/attachments work in the block editor?**
> Paste/drag to embed (Recommended) — Paste or drag images into the editor. Files saved to tasks/<taskid>/attachments/. Displayed inline in the document.

**Q: What build tooling do you prefer for the Electron + React project?**
> Vite + electron-vite (Recommended) — Fast HMR, modern ESM, purpose-built for Electron. Used by many modern Electron apps.

**Q: Should the app auto-start agent commands when a task moves to 'In Progress'?**
> Manual launch only (Recommended) — User opens task, then manually starts agent in terminal. Full control. Simpler and safer.

### User Clarification on Dependencies/Testing/Orchestration

When asked about task dependencies, orchestration, and E2E testing approach, the user clarified:

> all these refers to the fact that to develop this app I want to do it like this. this is how you need to create the PRD document speccing the tasks

Meaning: the questions about dependencies, parallelization, and testing strategy are about **how we build this app** (the development process), not features of the app itself.

---

## Decision Summary Tables

### Tech Stack

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **App framework** | Electron | Requirement. Must be browser-portable eventually for managing remote agents. |
| **Frontend framework** | React | User knows React well. Most Electron terminal apps use React. Closest to Linear's stack. |
| **Language** | TypeScript (strict mode) | Throughout the entire codebase. Other languages only if needed for performance. |
| **State management** | Zustand or Jotai — NOT Redux | User explicitly rejected Redux. Wants something simple. |
| **Build tooling** | Vite + electron-vite | Fast HMR, modern ESM, purpose-built for Electron. |
| **Testing** | Playwright + Electron for E2E, Vitest for unit tests | Playwright has first-class Electron support. |
| **Target platform** | macOS only (initial release) | Ship faster. Add Linux/Windows later. |

### Browser Portability Constraint

**CRITICAL**: The app must be designed to run in the browser at some point to manage remote agents. This means:
- All Electron-specific APIs must be abstracted behind TypeScript interfaces
- Terminal backend must be abstractable (local tmux vs remote tmux over SSH/WebSocket)
- No hard coupling to Electron main process for core logic
- File I/O must be abstracted (local fs vs remote API)

### Terminal Integration

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Terminal rendering** | xterm.js + node-pty | Industry standard. Used by VS Code, Hyper, Tabby, Wave Terminal. |
| **Session management** | Real tmux underneath | Sessions survive app restarts. Requires tmux installed. When browser version comes, tmux runs on remote server. |
| **Agent model** | Agent-agnostic | Any CLI command can be spawned (claude, aider, codex, custom scripts). No deep integration with any specific agent. |
| **Agent launch** | Manual launch only | User opens task, then manually starts agent in terminal. No auto-start when moving to "In Progress". |
| **Agent completion detection** | CLI hook only | Agent calls `kanban-agent status <id> done` when finished. Simple, agent-agnostic. |
| **Session persistence** | Via tmux | Switching tasks reattaches to that task's tmux session. Full scrollback history preserved. |

### Kanban Board & Task Model

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Task statuses/columns** | Backlog, Todo, In Progress, In Review, Done, Cancelled | Linear-style. Familiar and sufficient. |
| **Task hierarchy** | Flat with labels/tags | No sub-tasks. Use labels/tags to group related tasks. Simpler data model. Can add hierarchy later. |
| **Drag and drop** | Full drag-and-drop between columns | Classic kanban UX like Linear/Trello. Reorder within columns. |
| **Card display** | Title + status + priority + agent indicator | Clean and informative. Shows if agent is running/stopped/done. |
| **State file format** | JSON files | Simple, human-readable, easy to diff in git. `state.json` + `tasks/taskid/task.json`. |
| **Project model** | Single project (open folder) | Open a folder, see its kanban. Switch by opening different folder. Like VS Code's workspace model. |

### Task Detail View

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Default layout** | Editor on LEFT, terminal on RIGHT | User's explicit preference. |
| **Panel arrangement** | Flexible panels (drag to arrange) | User can rearrange panels after opening. Default is editor-left, terminal-right. |
| **Open animation** | Card expand animation | Card smoothly expands to fill the view, like Linear's issue open animation. |
| **Activity log** | Linear-style activity feed | Chronological feed showing status changes, agent events, human notes. Stored in task folder. |

### Editor

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Editor type** | Block editor (TipTap/BlockNote) | Close to Linear's block editor. Easier markdown visualization. NOT Monaco. User initially said Monaco then corrected. |
| **Collaboration readiness** | CRDT-ready via Yjs | Use Yjs/CRDT backend from the start so collaborative editing can be added later without rewrite. |
| **Images/attachments** | Paste/drag to embed | Paste or drag images into editor. Files saved to `tasks/<taskid>/attachments/`. Displayed inline. |
| **Attachment storage** | In task folder | All attachments and pictures stored in `tasks/<taskid>/attachments/` alongside the task. |

### UX & Design

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Visual theme** | Linear-clone aesthetic | Dark mode, clean lines, Inter font, muted colors, smooth animations. Very close to Linear's look. |
| **Command palette** | Cmd+K with search + actions | Search tasks, run actions, navigate. Core Linear UX. |
| **Keyboard shortcuts** | Linear-style (j/k, Enter, x, etc.) | Keyboard-first experience. j/k navigate, Enter opens, x selects. |

### CLI

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **CLI scope** | Full CRUD + init + sync + import | `init`, `add`, `list`, `status`, `update`, `delete`, `log`, `notify`, `open`, `sync`, `import`. |
| **Import** | From markdown spec file | Parse markdown into tasks. For bootstrapping projects from PRDs. |

### Notifications

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Notification channels** | OS native (macOS) + sound only | Simple. No external deps. No Slack/webhook in v1. |

### Users & Auth

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **User model** | Single-user, local-first | No auth needed. One user, local filesystem. Multi-user deferred to browser version. |

---

## Research Findings: Terminal Emulator Architecture

All serious Electron terminal apps use **xterm.js + node-pty**:

- **Tabby** (~69k stars): Angular, WebGL renderer, plugin architecture
- **Hyper** (~44k stars): React+Redux, WebGL, Vercel
- **Wave Terminal** (rising): React/TS frontend + Go backend (most innovative — offloads heavy work to Go process)
- **VS Code** (~170k stars): xterm.js WebGL renderer, maintained by same team as xterm.js
- **electerm** (~11k stars): Electron + xterm.js + node-pty, terminal/SSH/SFTP client

### Architecture Comparison

| Project | Stars | Terminal Lib | Renderer | Backend | UI Framework | License |
|---------|-------|-------------|----------|---------|-------------|---------|
| **Tabby** | ~69.4k | xterm.js | WebGL/Canvas/DOM | node-pty (Node.js) | Angular | MIT |
| **Hyper** | ~44.6k | xterm.js | WebGL | node-pty (Node.js) | React+Redux | MIT |
| **Wave** | Rising | xterm.js | xterm.js default | **Go backend** | React/TS | Apache 2.0 |
| **VS Code** | ~170k+ | xterm.js | WebGL (default) | node-pty | Custom | MIT |
| **electerm** | ~11k+ | xterm.js | xterm.js default | node-pty | React | MIT |

### Key Architectural Patterns

1. **The IPC bottleneck problem**: Every Electron terminal faces the same challenge — PTY runs in main process, rendering in renderer, all data crosses IPC. Solutions: data batching (Hyper), moving heavy work to separate backend (Wave's Go backend).

2. **xterm.js is the de facto standard**: No real competitor for web-based terminal rendering. Microsoft-maintained.

3. **node-pty is universal**: Standard for PTY management in Node.js/Electron. Also Microsoft-maintained.

4. **Wave's Go backend is most innovative**: Offloads shell management to Go process, avoiding Node.js single-threaded bottleneck. Most relevant for our future browser portability goal.

5. **Performance ceiling**: All Electron terminals are slower than native (Alacritty, Kitty, WezTerm, Ghostty). WebGL renderer narrows the gap significantly.

### xterm.js Renderer Hierarchy (performance best to worst)

1. **WebGL renderer** — 3-5x faster than canvas, GPU-accelerated
2. **Canvas renderer** — fallback when WebGL unavailable
3. **DOM renderer** — slowest but most compatible

### Sources

- [Hyper Terminal](https://github.com/vercel/hyper)
- [Tabby Terminal](https://github.com/Eugeny/tabby)
- [Wave Terminal](https://github.com/wavetermdev/waveterm)
- [xterm.js](https://github.com/xtermjs/xterm.js)
- [node-pty](https://github.com/microsoft/node-pty)
- [electerm](https://github.com/electerm/electerm)
