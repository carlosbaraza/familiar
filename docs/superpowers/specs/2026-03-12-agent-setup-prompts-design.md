# Agent Setup Prompts & AGENTS.md Architecture

**Date:** 2026-03-12
**Status:** Approved

## Summary

Add copyable AI-agent prompts for tmux setup and environment diagnostics, accessible via CLI commands, terminal UI help button, and Electron Help menu. Establish a layered AGENTS.md architecture where the CLI provides base agent instructions and the `.claude/skills/kanban-agent` skill delegates to it with user-override support.

## Components

### 1. Shared Prompt Templates (`src/shared/prompts.ts`)

Three exported string constants:

- **`TMUX_SETUP_PROMPT`** — Minimal tmux setup instructions for kanban-agent (install, mouse support, scrollback, session naming)
- **`DOCTOR_PROMPT`** — Diagnostic prompt: check tmux, kanban-agent CLI, `.kanban-agent/` dir, tmux config; report then offer fixes
- **`BASE_AGENTS_MD`** — Canonical AGENTS.md: agent workflow, CLI commands, status updates, logging, completion signals

### 2. CLI Commands (`src/cli/commands/`)

| Command | Description | Flags |
|---------|-------------|-------|
| `kanban-agent setup` | Print tmux setup prompt | `--copy` (clipboard via pbcopy) |
| `kanban-agent doctor` | Print doctor diagnostic prompt | `--copy` |
| `kanban-agent agents` | Print base AGENTS.md | `--copy` |

All print to stdout by default, `--copy` additionally copies to clipboard.

### 3. Terminal Help Button (`TerminalPanel.tsx`)

- `?` icon button in the snippet bar (next to gear icon)
- Click opens dropdown with three copy options:
  - Copy Tmux Setup Prompt
  - Copy Doctor Prompt
  - Copy AGENTS.md
- "Copied!" feedback after each action

### 4. Help Menu Items (`src/main/menu.ts`)

Added to Help submenu:
- Copy Tmux Setup Prompt
- Copy Doctor Prompt
- Copy AGENTS.md
- ---
- Install CLI

Uses Electron `clipboard.writeText()`.

### 5. AGENTS.md Skill Architecture

- **Base content** lives in `src/shared/prompts.ts` as `BASE_AGENTS_MD`, served by `kanban-agent agents`
- **Skill** (`~/.claude/skills/kanban-agent/SKILL.md`) tells agents to run `kanban-agent agents` for base instructions
- **User overrides** section in the skill for customization

## Approach

CLI-first (Approach A): all prompt content in `src/shared/prompts.ts`, imported by both CLI and Electron. Single source of truth.
