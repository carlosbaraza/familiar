import { Command } from 'commander'
import chalk from 'chalk'
import { execSync } from 'child_process'
import { BASE_AGENTS_MD } from '../../shared/prompts'

export function agentsCommand(): Command {
  return new Command('agents')
    .description('Print the base AGENTS.md for AI agent onboarding')
    .option('--copy', 'Copy the prompt to clipboard')
    .action((_opts: { copy?: boolean }) => {
      console.log(BASE_AGENTS_MD)

      if (_opts.copy) {
        try {
          execSync('pbcopy', { input: BASE_AGENTS_MD })
          console.log(chalk.green('\nCopied to clipboard.'))
        } catch {
          console.error(chalk.red('\nFailed to copy to clipboard.'))
        }
      }
    })
}
