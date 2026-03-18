import { Command } from 'commander'
import * as fs from 'fs/promises'
import * as path from 'path'
import chalk from 'chalk'
import { DOCUMENT_FILE, DEFAULT_LABEL_COLOR } from '../../shared/constants'
import type { TaskStatus, Priority } from '../../shared/types'
import { createTask } from '../../shared/utils/task-utils'
import { generateActivityId } from '../../shared/utils/id-generator'
import { isValidTaskStatus, isValidPriority } from '../../shared/utils/validators'
import {
  getProjectRoot,
  readProjectState,
  writeProjectState,
  writeTask,
  appendActivity,
  ensureTaskDir,
  readSettings,
  writeSettings
} from '../lib/file-ops'

export function addCommand(): Command {
  return new Command('add')
    .description('Add a new task to the board')
    .argument('<title>', 'Task title')
    .option('-p, --priority <priority>', 'Priority (urgent, high, medium, low, none)', 'none')
    .option('-s, --status <status>', 'Initial status (todo, in-progress, in-review, done, archived)', 'todo')
    .option('-l, --labels <labels>', 'Comma-separated labels')
    .option('-b, --body <text>', 'Task body/description (supports markdown)')
    .option('-f, --body-file <path>', 'Read task body from a file')
    .option('--parent <taskId>', 'Create as subtask of an existing task')
    .option('--fork-from <taskId>', 'Alias for --parent (deprecated)')
    .action(async (rawTitle: string, opts: { priority: string; status: string; labels?: string; body?: string; bodyFile?: string; parent?: string; forkFrom?: string }) => {
      const root = getProjectRoot()

      // Support multi-line: first line is the title, rest goes into the document
      const lines = rawTitle.split('\n')
      const title = lines[0].trim()
      let documentContent = lines.slice(1).join('\n').trim()

      // --body-file takes precedence over --body, which takes precedence over multiline title
      if (opts.bodyFile) {
        try {
          documentContent = (await fs.readFile(opts.bodyFile, 'utf-8')).trim()
        } catch (err) {
          console.error(chalk.red(`Cannot read body file: ${opts.bodyFile}`))
          process.exit(1)
        }
      } else if (opts.body) {
        documentContent = opts.body
      }

      // Validate priority
      if (!isValidPriority(opts.priority)) {
        console.error(chalk.red(`Invalid priority: ${opts.priority}`))
        console.error(chalk.dim('Valid values: urgent, high, medium, low, none'))
        process.exit(1)
      }

      // Validate status
      if (!isValidTaskStatus(opts.status)) {
        console.error(chalk.red(`Invalid status: ${opts.status}`))
        console.error(chalk.dim('Valid values: todo, in-progress, in-review, done, archived'))
        process.exit(1)
      }

      const labels = opts.labels ? opts.labels.split(',').map((l) => l.trim()).filter(Boolean) : []

      // Read current state to determine sort order
      let state
      try {
        state = await readProjectState(root)
      } catch {
        console.error(chalk.red('Project not initialized. Run `familiar init` first.'))
        process.exit(1)
      }

      // Shift existing tasks in the target column down to make room at the top
      for (const t of state.tasks) {
        if (t.status === opts.status) {
          t.sortOrder += 1
        }
      }

      // Support --parent or deprecated --fork-from
      const parentTaskId = opts.parent ?? opts.forkFrom

      // Validate parent exists if specified
      if (parentTaskId) {
        const parentExists = state.tasks.some((t) => t.id === parentTaskId)
        if (!parentExists) {
          console.error(chalk.red(`Parent task not found: ${parentTaskId}`))
          process.exit(1)
        }
      }

      const task = createTask(title, {
        status: opts.status as TaskStatus,
        priority: opts.priority as Priority,
        labels,
        sortOrder: 0,
        ...(parentTaskId ? { parentTaskId } : {})
      })

      // Create task directory with files
      await ensureTaskDir(root, task.id)
      await writeTask(root, task)

      // Write document.md (with notes content if multi-line input was provided)
      const { getDataPath } = await import('../lib/file-ops')
      const docPath = path.join(getDataPath(root), 'tasks', task.id, DOCUMENT_FILE)
      await fs.writeFile(docPath, documentContent, 'utf-8')

      // Write initial activity
      await appendActivity(root, task.id, {
        id: generateActivityId(),
        timestamp: task.createdAt,
        type: 'created',
        message: `Task created: ${title}`
      })

      // Handle parent/subtask relationships
      if (parentTaskId) {
        // Update parent's subtaskIds array
        const parent = state.tasks.find((t) => t.id === parentTaskId)!
        parent.subtaskIds = [...(parent.subtaskIds ?? []), task.id]
        await writeTask(root, parent)

        // Log activity on both tasks
        await appendActivity(root, parentTaskId, {
          id: generateActivityId(),
          timestamp: task.createdAt,
          type: 'status_change',
          message: `Created subtask ${task.id}`
        })
        await appendActivity(root, task.id, {
          id: generateActivityId(),
          timestamp: task.createdAt,
          type: 'status_change',
          message: `Subtask created from ${parentTaskId}`
        })
      }

      // Update state
      state.tasks.push(task)
      // Add new labels to settings
      if (labels.length > 0) {
        const settings = await readSettings(root)
        const settingsLabels = settings.labels ?? []
        let settingsChanged = false
        for (const label of labels) {
          if (!settingsLabels.some((l) => l.name === label)) {
            settingsLabels.push({ name: label, color: DEFAULT_LABEL_COLOR })
            settingsChanged = true
          }
        }
        if (settingsChanged) {
          settings.labels = settingsLabels
          await writeSettings(root, settings)
        }
      }
      // Keep project state labels in sync
      for (const label of labels) {
        if (!state.labels.some((l) => l.name === label)) {
          state.labels.push({ name: label, color: DEFAULT_LABEL_COLOR })
        }
      }
      await writeProjectState(root, state)

      console.log(chalk.green(`Task created: ${chalk.bold(task.id)}`))
      console.log(chalk.dim(`  Title:    ${task.title}`))
      console.log(chalk.dim(`  Status:   ${task.status}`))
      console.log(chalk.dim(`  Priority: ${task.priority}`))
      if (labels.length > 0) {
        console.log(chalk.dim(`  Labels:   ${labels.join(', ')}`))
      }
      if (parentTaskId) {
        console.log(chalk.dim(`  Parent:   ${parentTaskId}`))
      }
    })
}
