import { Command } from 'commander'
import chalk from 'chalk'
import type { TaskStatus } from '../../shared/types'
import { COLUMN_LABELS } from '../../shared/constants'
import { isValidTaskStatus } from '../../shared/utils/validators'
import { generateActivityId } from '../../shared/utils/id-generator'
import {
  getProjectRoot,
  readProjectState,
  writeProjectState,
  writeTask,
  readTask,
  appendActivity
} from '../lib/file-ops'

export function statusCommand(): Command {
  return new Command('status')
    .description('Update the status of a task')
    .argument('<id>', 'Task ID')
    .argument('<status>', 'New status (backlog, todo, in-progress, in-review, done, cancelled)')
    .action(async (id: string, status: string) => {
      if (!isValidTaskStatus(status)) {
        console.error(chalk.red(`Invalid status: ${status}`))
        console.error(chalk.dim('Valid values: backlog, todo, in-progress, in-review, done, cancelled'))
        process.exit(1)
      }

      const root = getProjectRoot()

      let state
      try {
        state = await readProjectState(root)
      } catch {
        console.error(chalk.red('Project not initialized. Run `kanban-agent init` first.'))
        process.exit(1)
      }

      const taskIndex = state.tasks.findIndex((t) => t.id === id)
      if (taskIndex === -1) {
        console.error(chalk.red(`Task not found: ${id}`))
        process.exit(1)
      }

      const oldStatus = state.tasks[taskIndex].status
      const newStatus = status as TaskStatus
      const now = new Date().toISOString()

      // Update task in state
      state.tasks[taskIndex].status = newStatus
      state.tasks[taskIndex].updatedAt = now

      // Update task file
      const task = await readTask(root, id)
      task.status = newStatus
      task.updatedAt = now
      await writeTask(root, task)

      // Log activity
      await appendActivity(root, id, {
        id: generateActivityId(),
        timestamp: now,
        type: 'status_change',
        message: `Status changed from ${COLUMN_LABELS[oldStatus]} to ${COLUMN_LABELS[newStatus]}`,
        metadata: { from: oldStatus, to: newStatus }
      })

      // Write state
      await writeProjectState(root, state)

      console.log(chalk.green(`Task ${chalk.bold(id)} status updated: ${COLUMN_LABELS[oldStatus]} -> ${COLUMN_LABELS[newStatus]}`))

      if (newStatus === 'done') {
        console.log(chalk.dim('Hint: Use `kanban-agent notify` to send a completion notification.'))
      }
    })
}
