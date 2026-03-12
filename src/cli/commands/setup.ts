import { Command } from 'commander'
import chalk from 'chalk'
import { execSync } from 'child_process'
import { TMUX_SETUP_PROMPT } from '../../shared/prompts'

export function setupCommand(): Command {
  return new Command('setup')
    .description('Print tmux setup instructions for your AI agent')
    .option('--copy', 'Copy the prompt to clipboard')
    .action((_opts: { copy?: boolean }) => {
      console.log(TMUX_SETUP_PROMPT)

      if (_opts.copy) {
        try {
          execSync('pbcopy', { input: TMUX_SETUP_PROMPT })
          console.log(chalk.green('\nCopied to clipboard.'))
        } catch {
          console.error(chalk.red('\nFailed to copy to clipboard.'))
        }
      }
    })
}
