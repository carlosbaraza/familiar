import { Command } from 'commander'
import { execSync } from 'child_process'
import chalk from 'chalk'

export function notifyCommand(): Command {
  return new Command('notify')
    .description('Send a macOS notification')
    .argument('<title>', 'Notification title')
    .argument('[body]', 'Notification body')
    .action(async (title: string, body?: string) => {
      const bodyPart = body ? ` with title "${body}"` : ''
      const script = `display notification "${title}"${bodyPart} sound name "default"`

      try {
        execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { stdio: 'ignore' })
        console.log(chalk.green('Notification sent.'))
      } catch {
        console.error(chalk.red('Failed to send notification. Make sure you are on macOS.'))
        process.exit(1)
      }
    })
}
