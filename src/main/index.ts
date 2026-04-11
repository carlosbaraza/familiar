import { app, BrowserWindow, shell, protocol, net, nativeTheme, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ElectronTmuxManager } from './platform/electron-tmux'
import { ElectronPtyManager } from './platform/electron-pty'
import { registerPtyHandlers } from './ipc/pty-handlers'
import { registerTmuxHandlers } from './ipc/tmux-handlers'
import { registerFileHandlers } from './ipc/file-handlers'
import { registerNotificationHandlers } from './ipc/notification-handlers'
import { registerWindowHandlers } from './ipc/window-handlers'
import { registerCliHandlers } from './ipc/cli-handlers'
import { registerUpdateHandlers } from './ipc/update-handlers'
import { registerWorkspaceHandlers } from './ipc/workspace-handlers'
import { registerHealthHandlers } from './ipc/health-handlers'
import { registerWorktreeHandlers } from './ipc/worktree-handlers'
import { DataService } from './services/data-service'
import { WorkspaceManager } from './services/workspace-manager'
import { UpdateService } from './services/update-service'
import { buildAppMenu } from './menu'

// Prevent unhandled errors from crashing the app (e.g. PTY spawn failures under EMFILE)
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in main process:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in main process:', reason)
})

const tmuxManager = new ElectronTmuxManager()
const ptyManager = new ElectronPtyManager(tmuxManager)
const updateService = new UpdateService()
const workspaceManager = new WorkspaceManager()

// Register custom protocol scheme for serving attachment files
// Must be called before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'familiar-attachment',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true
    }
  }
])

// Parse --project-root from command line arguments
function getProjectRootFromArgs(): { root: string; explicit: boolean } {
  const args = process.argv
  const idx = args.indexOf('--project-root')
  if (idx !== -1 && args[idx + 1]) {
    return { root: args[idx + 1], explicit: true }
  }
  return { root: process.cwd(), explicit: false }
}

const projectRootInfo = getProjectRootFromArgs()

// Open the initial project via WorkspaceManager
workspaceManager.openSingleProject(projectRootInfo.root)
// Create a SEPARATE DataService for IPC handlers. This must NOT be the
// same object as the workspace manager's internal map entry, because
// syncLegacyRefs() mutates its projectRoot when switching projects —
// using the same object would corrupt the map entry for the initial project.
const dataService = new DataService(projectRootInfo.root)
ptyManager.setDataService(dataService)

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: join(__dirname, '../../build/icon.png'),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Give workspace manager reference to the window for file watchers
  workspaceManager.setMainWindow(mainWindow)

  // FOUC Prevention: inject theme before showing the window. Uses the
  // effective theme (active workspace > global settings) so the splash
  // matches whatever the renderer will load a moment later.
  mainWindow.webContents.once('dom-ready', async () => {
    try {
      const theme = workspaceManager.readEffectiveTheme()
      const mode = theme.themeMode
      let themeId: string
      if (mode === 'dark') themeId = theme.darkTheme
      else if (mode === 'light') themeId = theme.lightTheme
      else themeId = nativeTheme.shouldUseDarkColors ? theme.darkTheme : theme.lightTheme
      await mainWindow.webContents.executeJavaScript(
        `document.documentElement.setAttribute('data-theme', '${themeId}')`
      )
    } catch {
      await mainWindow.webContents.executeJavaScript(
        `document.documentElement.setAttribute('data-theme', 'familiar-dark')`
      )
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()

    // Projects opened before the window existed won't have file watchers.
    // Start them now that the window is available.
    workspaceManager.ensureFileWatchers(mainWindow)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite CLI.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Register IPC handlers
  registerPtyHandlers(ptyManager, mainWindow)
  registerTmuxHandlers(tmuxManager, dataService)
  registerFileHandlers(dataService, () => workspaceManager.getFileWatcher())
  registerNotificationHandlers(dataService, workspaceManager)
  registerWindowHandlers(
    mainWindow,
    dataService,
    workspaceManager
  )
  registerCliHandlers()
  registerUpdateHandlers(mainWindow, updateService)
  registerWorkspaceHandlers(workspaceManager, dataService, ptyManager)
  registerHealthHandlers(workspaceManager, dataService)
  registerWorktreeHandlers(dataService)

  // Build and set the application menu
  const appMenu = buildAppMenu(mainWindow, updateService)
  Menu.setApplicationMenu(appMenu)
}

app.whenReady().then(async () => {
  // Set app user model id for macOS
  electronApp.setAppUserModelId('com.familiar')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window, { zoom: true })
  })

  // Handle familiar-attachment:// protocol requests by serving local files
  // Supports two URL formats:
  //   familiar-attachment://file/<absolute-path>           (legacy)
  //   familiar-attachment://task/<taskId>/attachments/<filename>  (relative, portable)
  protocol.handle('familiar-attachment', (request) => {
    const url = new URL(request.url)
    const host = url.host // "file" or "task"

    if (host === 'task') {
      // Relative format: familiar-attachment://task/<taskId>/attachments/<filename>
      const parts = url.pathname.split('/').filter(Boolean)
      const taskId = decodeURIComponent(parts[0])
      const fileName = decodeURIComponent(parts.slice(2).join('/')) // skip "attachments"
      const projectRoot = dataService.getProjectRoot()
      const filePath = join(projectRoot, '.familiar', 'tasks', taskId, 'attachments', fileName)
      return net.fetch(`file://${filePath}`)
    }

    // Legacy absolute path format: familiar-attachment://file/<absolute-path>
    const filePath = decodeURIComponent(url.pathname)
    return net.fetch(`file://${filePath}`)
  })

  // When --project-root was explicitly provided (e.g. "Open Workspace in New Window"),
  // auto-initialize the .familiar/ folder so the renderer doesn't prompt again.
  if (projectRootInfo.explicit) {
    const initialized = await dataService.isInitialized()
    if (!initialized) {
      const folderName = projectRootInfo.root.split('/').pop() || 'Untitled'
      await dataService.initProject(folderName)
    }
  }

  createWindow()

  app.on('activate', () => {
    // On macOS re-create a window when the dock icon is clicked
    // and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  workspaceManager.closeAll()
  updateService.stopPeriodicCheck()
})
