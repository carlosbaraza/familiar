import { ipcMain, BrowserWindow, dialog, app, shell } from 'electron'
import { execFile } from 'child_process'
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
      if (editor === 'custom' && customCommand) {
        const [cmd, ...args] = customCommand.split(/\s+/)
        return new Promise<string>((resolve) => {
          execFile(cmd, [...args, path], (err) => {
            resolve(err ? err.message : '')
          })
        })
      }

      if (editor && editor !== 'system' && editor !== 'custom') {
        const cmd = CODE_EDITOR_COMMANDS[editor]
        if (cmd) {
          return new Promise<string>((resolve) => {
            execFile(cmd, [path], (err) => {
              resolve(err ? err.message : '')
            })
          })
        }
      }

      // System default: use macOS `open`
      return shell.openPath(path)
    }
  )
}
