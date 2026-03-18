import { Command } from 'commander'
import chalk from 'chalk'
import {
  getProjectRoot,
  readProjectState,
  writeProjectState,
  writeTask,
  deleteTaskDir
} from '../lib/file-ops'

export function deleteCommand(): Command {
  return new Command('delete')
    .description('Delete a task from the board')
    .argument('<id>', 'Task ID')
    .action(async (id: string) => {
      const root = getProjectRoot()

      let state
      try {
        state = await readProjectState(root)
      } catch {
        console.error(chalk.red('Project not initialized. Run `familiar init` first.'))
        process.exit(1)
      }

      const taskIndex = state.tasks.findIndex((t) => t.id === id)
      if (taskIndex === -1) {
        console.error(chalk.red(`Task not found: ${id}`))
        process.exit(1)
      }

      const task = state.tasks[taskIndex]

      // If this is a subtask, remove it from the parent's subtaskIds array
      if (task.parentTaskId) {
        const parent = state.tasks.find((t) => t.id === task.parentTaskId)
        if (parent && parent.subtaskIds) {
          parent.subtaskIds = parent.subtaskIds.filter((sid) => sid !== id)
          await writeTask(root, parent)
        }
      }

      // If this is a parent task, orphan all subtasks
      if (task.subtaskIds && task.subtaskIds.length > 0) {
        for (const subtaskId of task.subtaskIds) {
          const subtask = state.tasks.find((t) => t.id === subtaskId)
          if (subtask) {
            subtask.parentTaskId = undefined
            await writeTask(root, subtask)
          }
        }
      }

      // Remove from state
      state.tasks.splice(taskIndex, 1)
      await writeProjectState(root, state)

      // Remove task directory
      await deleteTaskDir(root, id)

      console.log(chalk.green(`Deleted task ${chalk.bold(id)}: ${task.title}`))
    })
}
