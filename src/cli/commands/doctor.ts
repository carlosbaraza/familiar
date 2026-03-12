import { Command } from 'commander'
import chalk from 'chalk'
import { execSync } from 'child_process'
import { DOCTOR_PROMPT } from '../../shared/prompts'

export function doctorCommand(): Command {
  return new Command('doctor')
    .description('Print environment diagnostic prompt for your AI agent')
    .option('--copy', 'Copy the prompt to clipboard')
    .action((_opts: { copy?: boolean }) => {
      console.log(DOCTOR_PROMPT)

      if (_opts.copy) {
        try {
          execSync('pbcopy', { input: DOCTOR_PROMPT })
          console.log(chalk.green('\nCopied to clipboard.'))
        } catch {
          console.error(chalk.red('\nFailed to copy to clipboard.'))
        }
      }
    })
}
