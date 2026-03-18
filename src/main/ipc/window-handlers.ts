import { ipcMain, BrowserWindow, dialog, app, shell } from 'electron'
import { spawn } from 'child_process'
import { DataService } from '../services/data-service'
import { WorkspaceManager } from '../services/workspace-manager'
import { CODE_EDITOR_COMMANDS } from '@shared/types/settings'
import type { CodeEditor } from '@shared/types/settings'

export function registerWindowHandlers(
  mainWindow: BrowserWindow,
  dataService: DataService,
  workspaceManager: WorkspaceManager
): void {
  ipcMain.handle('window:open-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    })
    return result.filePaths[0] || null
  })

  ipcMain.handle('project:set-root', async (_, newRoot: string) => {
    // Use WorkspaceManager to switch projects
    workspaceManager.openSingleProject(newRoot)
    // Update the legacy dataService reference for backward compatibility
    dataService.setProjectRoot(newRoot)
    return true
  })

  ipcMain.handle('app:version', async () => {
    return app.getVersion()
  })

  ipcMain.handle('shell:open-path', async (_, path: string) => {
    return shell.openPath(path)
  })

  ipcMain.handle('shell:open-external', async (_, url: string) => {
    return shell.openExternal(url)
  })

  ipcMain.handle(
    'shell:open-in-editor',
    async (_, path: string, editor?: CodeEditor, customCommand?: string) => {
      const runCommand = (cmd: string, args: string[]): Promise<string> =>
        new Promise<string>((resolve) => {
          const child = spawn(cmd, args, {
            shell: true,
            stdio: 'ignore',
            detached: true
          })
          child.on('error', (err) => resolve(err.message))
          child.on('spawn', () => {
            child.unref()
            resolve('')
          })
        })

      if (editor === 'custom' && customCommand) {
        const [cmd, ...args] = customCommand.split(/\s+/)
        return runCommand(cmd, [...args, path])
      }

      if (editor && editor !== 'system' && editor !== 'custom') {
        const cmd = CODE_EDITOR_COMMANDS[editor]
        if (cmd) {
          return runCommand(cmd, [path])
        }
      }

      // System default: use macOS `open`
      return shell.openPath(path)
    }
  )
}
