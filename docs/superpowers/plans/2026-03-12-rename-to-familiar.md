# Rename to Familiar — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the entire product from "Kanban Agent" / "kanban-agent" to "Familiar" / "familiar" across all user-visible strings, CLI, configs, data dirs, env vars, docs, and tests.

**Architecture:** This is a global rename operation. The kanban *board UI pattern* component names (KanbanBoard, KanbanColumn) stay as-is since "kanban" describes the UI methodology, not the product brand. Everything user/agent-facing changes.

**Rename mapping:**

| Old | New | Context |
|-----|-----|---------|
| `Kanban Agent` | `Familiar` | Display name, docs |
| `kanban-agent` | `familiar` | CLI command, package name, npm bin |
| `.kanban-agent` | `.familiar` | Data directory |
| `KANBAN_TASK_ID` | `FAMILIAR_TASK_ID` | Environment variable |
| `KANBAN_PROJECT_ROOT` | `FAMILIAR_PROJECT_ROOT` | Environment variable |
| `kanban-` (tmux prefix) | `familiar-` | Tmux session names |
| `com.kanban-agent.app` | `com.familiar.app` | Electron app ID |
| `com.kanban-agent` | `com.familiar` | User model ID |
| `kanban-attachment` | `familiar-attachment` | Custom protocol scheme |
| `~/.kanban-agent/bin/` | `~/.familiar/bin/` | CLI symlink location |

**Not renamed:** React component names (`KanbanBoard`, `KanbanColumn`) — these describe the kanban board UI pattern, not the product name.

---

## Chunk 1: Core Configuration & Constants

### Task 1: Package and build config

**Files:**
- Modify: `package.json`
- Modify: `electron-builder.config.js`
- Modify: `src/shared/constants.ts`
- Modify: `src/main/index.ts`
- Modify: `.gitignore`

- [ ] **Step 1:** Update `package.json` — name to `familiar`, bin key to `familiar`
- [ ] **Step 2:** Update `electron-builder.config.js` — appId to `com.familiar.app`, productName to `Familiar`
- [ ] **Step 3:** Update `src/shared/constants.ts` — DATA_DIR to `.familiar`, APP_NAME to `Familiar`
- [ ] **Step 4:** Update `src/main/index.ts` — user model ID to `com.familiar`, protocol scheme to `familiar-attachment`
- [ ] **Step 5:** Update `.gitignore` — `.kanban-agent/` to `.familiar/`
- [ ] **Step 6:** Run typecheck: `npm run typecheck`
- [ ] **Step 7:** Commit: `git commit -m "chore: rename core config from kanban-agent to familiar"`

### Task 2: Environment variables and tmux prefix

**Files:**
- Modify: `src/main/ipc/tmux-handlers.ts`
- Modify: `src/main/platform/electron-pty.ts`
- Modify: `src/main/platform/electron-tmux.ts`
- Modify: `src/shared/types/settings.ts`
- Modify: `src/cli/commands/notify.ts`

- [ ] **Step 1:** Replace all `KANBAN_TASK_ID` → `FAMILIAR_TASK_ID` and `KANBAN_PROJECT_ROOT` → `FAMILIAR_PROJECT_ROOT` in tmux-handlers.ts, electron-pty.ts
- [ ] **Step 2:** Update tmux session prefix in electron-tmux.ts: `kanban-` → `familiar-`
- [ ] **Step 3:** Update tmux session prefix in electron-pty.ts: `kanban-` → `familiar-`
- [ ] **Step 4:** Update default command in settings.ts: `$KANBAN_TASK_ID` → `$FAMILIAR_TASK_ID`
- [ ] **Step 5:** Update env var reference in cli/commands/notify.ts
- [ ] **Step 6:** Run tests: `npm test`
- [ ] **Step 7:** Commit: `git commit -m "chore: rename env vars KANBAN_* to FAMILIAR_* and tmux prefix"`

### Task 3: CLI entry and handlers

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `src/cli/commands/open.ts`
- Modify: `src/cli/commands/notify.ts`
- Modify: `src/main/ipc/cli-handlers.ts`
- Modify: `src/main/menu.ts`
- Modify: `src/renderer/src/components/board/CliSetupBanner.tsx`

- [ ] **Step 1:** Update CLI name in `src/cli/index.ts`: `.name('familiar')`
- [ ] **Step 2:** Update app name in `src/cli/commands/open.ts`: `'Familiar'`
- [ ] **Step 3:** Update CLI install paths in `src/main/ipc/cli-handlers.ts`: `~/.familiar/bin/familiar`
- [ ] **Step 4:** Update GitHub URL in `src/main/menu.ts` if applicable
- [ ] **Step 5:** Update CLI setup banner strings in CliSetupBanner.tsx
- [ ] **Step 6:** Run tests: `npm test`
- [ ] **Step 7:** Commit: `git commit -m "chore: rename CLI and UI strings to familiar"`

## Chunk 2: Agent Instructions, Prompts & Docs

### Task 4: Agent instructions and prompts

**Files:**
- Modify: `src/shared/agent-instructions.ts`
- Modify: `src/shared/prompts.ts`

- [ ] **Step 1:** Replace all `kanban-agent` → `familiar`, `.kanban-agent` → `.familiar`, `KANBAN_*` → `FAMILIAR_*` in agent-instructions.ts
- [ ] **Step 2:** Same replacements in prompts.ts
- [ ] **Step 3:** Run tests: `npm test`
- [ ] **Step 4:** Commit: `git commit -m "chore: rename agent instructions and prompts to familiar"`

### Task 5: Documentation files

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `docs/EXECUTIVE_DECISIONS.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PRD.md`
- Modify: `docs/superpowers/specs/*.md`
- Modify: `docs/superpowers/plans/*.md`

- [ ] **Step 1:** Replace all kanban-agent references in each doc file
- [ ] **Step 2:** Commit: `git commit -m "docs: rename all references from kanban-agent to familiar"`

## Chunk 3: Tests and Remaining References

### Task 6: Test files

**Files:**
- Modify: `src/main/services/data-service.test.ts`
- Modify: `src/cli/lib/file-ops.test.ts`
- Modify: `tests/integration/data-service-workflow.test.ts`

- [ ] **Step 1:** Replace `.kanban-agent` → `.familiar` in all test files
- [ ] **Step 2:** Run full test suite: `npm test`
- [ ] **Step 3:** Commit: `git commit -m "test: update test references from kanban-agent to familiar"`

### Task 7: Renderer and store references

**Files:**
- Modify: `src/renderer/src/stores/task-store.ts`
- Modify: `src/renderer/src/components/task-detail/TaskDetailHeader.tsx`
- Modify: `src/cli/lib/file-ops.ts`

- [ ] **Step 1:** Replace `.kanban-agent` references in task-store.ts, TaskDetailHeader.tsx, file-ops.ts
- [ ] **Step 2:** Run tests: `npm test`
- [ ] **Step 3:** Commit: `git commit -m "chore: rename remaining .kanban-agent references to .familiar"`

### Task 8: Settings and hooks

**Files:**
- Modify: `.claude/settings.json`

- [ ] **Step 1:** Update kanban-agent and KANBAN_* references in claude settings hooks
- [ ] **Step 2:** Commit: `git commit -m "chore: update claude settings for familiar rename"`

### Task 9: Final verification

- [ ] **Step 1:** Run `npm run typecheck`
- [ ] **Step 2:** Run `npm test`
- [ ] **Step 3:** Grep for any remaining `kanban-agent` or `KANBAN_` references (excluding node_modules, .git, coverage)
- [ ] **Step 4:** Fix any remaining references
- [ ] **Step 5:** Final commit if needed
