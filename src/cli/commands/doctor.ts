import { Command } from 'commander'
import chalk from 'chalk'
import { execSync } from 'child_process'
import { DOCTOR_PROMPT, DOCTOR_AUTO_FIX_SUFFIX } from '../../shared/prompts'

export function doctorCommand(): Command {
  return new Command('doctor')
    .description('Print environment diagnostic prompt for your AI agent')
    .option('--copy', 'Copy the prompt to clipboard')
    .option('--auto-fix', 'Append auto-fix instructions (fix everything without asking)')
    .action((_opts: { copy?: boolean; autoFix?: boolean }) => {
      const prompt = _opts.autoFix ? DOCTOR_PROMPT + DOCTOR_AUTO_FIX_SUFFIX : DOCTOR_PROMPT

      console.log(prompt)

      if (_opts.copy) {
        try {
          execSync('pbcopy', { input: prompt })
          console.log(chalk.green('\nCopied to clipboard.'))
        } catch {
          console.error(chalk.red('\nFailed to copy to clipboard.'))
        }
      }
    })
}
