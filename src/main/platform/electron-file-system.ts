import fs from 'fs/promises'
import path from 'path'
import type { IFileSystem } from '../../shared/platform/file-system'
import { TASKS_DIR, ATTACHMENTS_DIR, DATA_DIR } from '../../shared/constants'

export class ElectronFileSystem implements IFileSystem {
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8')
  }

  async writeFile(filePath: string, data: string): Promise<void> {
    await fs.writeFile(filePath, data, 'utf-8')
  }

  async writeFileAtomic(filePath: string, data: string): Promise<void> {
    const dir = path.dirname(filePath)
    const tmpFile = path.join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    try {
      await fs.writeFile(tmpFile, data, 'utf-8')
      await fs.rename(tmpFile, filePath)
    } catch (err) {
      // Clean up temp file on failure
      try {
        await fs.unlink(tmpFile)
      } catch (_) {
        // ignore cleanup errors
      }
      throw err
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  async mkdir(dirPath: string, recursive?: boolean): Promise<void> {
    await fs.mkdir(dirPath, { recursive: recursive ?? false })
  }

  async readDir(dirPath: string): Promise<string[]> {
    return fs.readdir(dirPath)
  }

  async remove(filePath: string): Promise<void> {
    await fs.rm(filePath, { recursive: true, force: true })
  }

  async copyFile(src: string, dest: string): Promise<void> {
    await fs.copyFile(src, dest)
  }

  async saveAttachment(
    taskId: string,
    fileName: string,
    data: ArrayBuffer
  ): Promise<string> {
    // This method needs a projectRoot context to know where to save.
    // By convention, callers should use DataService.saveAttachment instead.
    // This implementation assumes cwd-relative paths as a fallback.
    const attachDir = path.join(
      DATA_DIR,
      TASKS_DIR,
      taskId,
      ATTACHMENTS_DIR
    )
    await this.mkdir(attachDir, true)
    const filePath = path.join(attachDir, fileName)
    await fs.writeFile(filePath, Buffer.from(data))
    return filePath
  }
}
