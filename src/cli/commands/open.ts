import { Command } from 'commander'
import { execSync } from 'child_process'
import chalk from 'chalk'

export function openCommand(): Command {
  return new Command('open')
    .description('Open the Kanban Agent app')
    .argument('[id]', 'Task ID to open')
    .action(async (id?: string) => {
      const appName = 'Familiar'

      try {
        if (id) {
          // Try to open the app with a deep link or pass the task ID
          execSync(`open -a "${appName}" --args --task=${id}`, { stdio: 'ignore' })
          console.log(chalk.green(`Opening task ${chalk.bold(id)} in ${appName}...`))
        } else {
          execSync(`open -a "${appName}"`, { stdio: 'ignore' })
          console.log(chalk.green(`Opening ${appName}...`))
        }
      } catch {
        console.error(chalk.red(`Could not open ${appName}. Is it installed?`))
        console.error(chalk.dim('You can build it with: npm run build'))
        process.exit(1)
      }
    })
}
