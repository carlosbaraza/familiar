import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // File operations (to be implemented)
  // readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  // writeFile: (path: string, data: string) => ipcRenderer.invoke('file:write', path, data),

  // PTY operations
  ptyCreate: (taskId: string, paneId: string, cwd: string): Promise<string> =>
    ipcRenderer.invoke('pty:create', taskId, paneId, cwd),
  ptyWrite: (sessionId: string, data: string): Promise<void> =>
    ipcRenderer.invoke('pty:write', sessionId, data),
  ptyResize: (sessionId: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke('pty:resize', sessionId, cols, rows),
  ptyDestroy: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('pty:destroy', sessionId),
  onPtyData: (callback: (sessionId: string, data: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, sessionId: string, data: string): void => {
      callback(sessionId, data)
    }
    ipcRenderer.on('pty:data', handler)
    return () => {
      ipcRenderer.removeListener('pty:data', handler)
    }
  },

  // Tmux operations
  tmuxList: (): Promise<string[]> => ipcRenderer.invoke('tmux:list'),
  tmuxAttach: (name: string): Promise<void> => ipcRenderer.invoke('tmux:attach', name),
  tmuxDetach: (name: string): Promise<void> => ipcRenderer.invoke('tmux:detach', name),

  // Notification operations (to be implemented)
  // notify: (title: string, body: string) => ipcRenderer.invoke('notification:send', title, body),

  // Placeholder version info
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
