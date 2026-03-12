import { Menu, app, dialog, BrowserWindow, shell, clipboard } from 'electron'
import { TMUX_SETUP_PROMPT, DOCTOR_PROMPT, BASE_AGENTS_MD } from '@shared/prompts'
import { spawn } from 'child_process'
import { is } from '@electron-toolkit/utils'

export function buildAppMenu(mainWindow: BrowserWindow): Menu {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Workspace…',
          accelerator: 'CmdOrCtrl+O',
          click: (): void => {
            mainWindow.webContents.send('menu:open-workspace')
          }
        },
        {
          label: 'Open Workspace in New Window…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async (): Promise<void> => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory']
            })
            const selectedPath = result.filePaths[0]
            if (!selectedPath) return

            if (is.dev) {
              // In development, spawn a new Electron process with the project root arg
              const electronPath = process.execPath
              const appPath = process.argv[1]
              spawn(electronPath, [appPath, '--project-root', selectedPath], {
                detached: true,
                stdio: 'ignore',
                env: { ...process.env }
              }).unref()
            } else {
              // In production, use 'open -n' to launch a new instance of the bundled app
              const appBundlePath = app.getPath('exe').replace(/\/Contents\/.*$/, '')
              spawn('open', ['-na', appBundlePath, '--args', '--project-root', selectedPath], {
                detached: true,
                stdio: 'ignore'
              }).unref()
            }
          }
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Copy Tmux Setup Prompt',
          click: (): void => {
            clipboard.writeText(TMUX_SETUP_PROMPT)
          }
        },
        {
          label: 'Copy Doctor Prompt',
          click: (): void => {
            clipboard.writeText(DOCTOR_PROMPT)
          }
        },
        {
          label: 'Copy AGENTS.md',
          click: (): void => {
            clipboard.writeText(BASE_AGENTS_MD)
          }
        },
        { type: 'separator' },
        {
          label: 'Install CLI',
          click: (): void => {
            mainWindow.webContents.send('menu:install-cli')
          }
        },
        { type: 'separator' },
        {
          label: 'Kanban Agent GitHub',
          click: (): void => {
            shell.openExternal('https://github.com/carlosbaraza/kanban-agent')
          }
        }
      ]
    }
  ]

  return Menu.buildFromTemplate(template)
}
