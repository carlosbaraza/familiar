import { Command } from 'commander'
import chalk from 'chalk'
import { generateActivityId } from '../../shared/utils/id-generator'
import {
  getProjectRoot,
  readProjectState,
  appendActivity
} from '../lib/file-ops'

export function logCommand(): Command {
  return new Command('log')
    .description('Add a note to a task activity log')
    .argument('<id>', 'Task ID')
    .argument('<message>', 'Log message')
    .action(async (id: string, message: string) => {
      const root = getProjectRoot()

      let state
      try {
        state = await readProjectState(root)
      } catch {
        console.error(chalk.red('Project not initialized. Run `familiar init` first.'))
        process.exit(1)
      }

      const task = state.tasks.find((t) => t.id === id)
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`))
        process.exit(1)
      }

      await appendActivity(root, id, {
        id: generateActivityId(),
        timestamp: new Date().toISOString(),
        type: 'note',
        message
      })

      console.log(chalk.green(`Note added to task ${chalk.bold(id)}`))
    })
}
