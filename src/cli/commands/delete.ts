import { Command } from 'commander'
import chalk from 'chalk'
import {
  getProjectRoot,
  readProjectState,
  writeProjectState,
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

      // Remove from state
      state.tasks.splice(taskIndex, 1)
      await writeProjectState(root, state)

      // Remove task directory
      await deleteTaskDir(root, id)

      console.log(chalk.green(`Deleted task ${chalk.bold(id)}: ${task.title}`))
    })
}
