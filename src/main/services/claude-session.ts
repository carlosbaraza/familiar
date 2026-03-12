import * as crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

/**
 * Generate a deterministic UUID v5 from a task ID.
 * Uses DNS namespace so the same task ID always produces the same UUID.
 */
export function taskIdToUuid(taskId: string): string {
  // UUID v5 namespace (DNS)
  const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  const nsBytes = Buffer.from(DNS_NAMESPACE.replace(/-/g, ''), 'hex')
  const hash = crypto.createHash('sha1').update(nsBytes).update(taskId).digest()
  // Set version (5) and variant bits per RFC 4122
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.toString('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/**
 * Resolve a Claude default command that contains `--resume $SOME_VAR` (or similar)
 * into either `--resume <uuid>` (if a prior session exists) or `--session-id <uuid>`
 * (if starting fresh). This avoids the interactive resume picker showing up when no
 * session matches the task ID.
 */
export function resolveClaudeSessionCommand(command: string, taskId: string, projectRoot: string): string {
  // Match --resume followed by a shell variable (e.g. $FAMILIAR_TASK_ID)
  const resumePattern = /--resume\s+["']?\$\w+["']?/
  if (!resumePattern.test(command)) return command

  const sessionUuid = taskIdToUuid(taskId)
  const claudeProjectDir = path.join(
    os.homedir(),
    '.claude',
    'projects',
    projectRoot.replace(/\//g, '-')
  )
  const sessionFile = path.join(claudeProjectDir, `${sessionUuid}.jsonl`)
  const hasExistingSession = fs.existsSync(sessionFile)

  if (hasExistingSession) {
    // Resume the existing session by its deterministic UUID
    return command.replace(resumePattern, `--resume "${sessionUuid}"`)
  } else {
    // Start a fresh session with the deterministic UUID (no resume picker)
    return command.replace(resumePattern, `--session-id "${sessionUuid}"`)
  }
}
