import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from '@renderer/stores/terminal-store'
import type { TerminalSession, TerminalPane } from '@shared/types'

function resetStore(): void {
  useTerminalStore.setState({
    sessions: new Map(),
    panesByTask: new Map(),
    activePaneByTask: new Map()
  })
}

describe('useTerminalStore', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('sessions', () => {
    it('addSession adds a session', () => {
      const session: TerminalSession = {
        id: 'sess-1',
        taskId: 'tsk_abc123',
        paneIndex: 0,
        sessionName: 'kanban-tsk_abc123-0',
        isActive: true
      }
      useTerminalStore.getState().addSession(session)
      expect(useTerminalStore.getState().sessions.get('sess-1')).toEqual(session)
    })

    it('removeSession removes a session', () => {
      const session: TerminalSession = {
        id: 'sess-1',
        taskId: 'tsk_abc123',
        paneIndex: 0,
        sessionName: 'kanban-tsk_abc123-0',
        isActive: true
      }
      useTerminalStore.getState().addSession(session)
      useTerminalStore.getState().removeSession('sess-1')
      expect(useTerminalStore.getState().sessions.has('sess-1')).toBe(false)
    })

    it('removeSession is a no-op for non-existent session', () => {
      useTerminalStore.getState().removeSession('nonexistent')
      expect(useTerminalStore.getState().sessions.size).toBe(0)
    })
  })

  describe('panes', () => {
    it('addPane adds a pane for a task', () => {
      const pane: TerminalPane = {
        id: 'pane-1',
        sessionName: 'kanban-tsk_abc123-0',
        title: 'Terminal 1'
      }
      useTerminalStore.getState().addPane('tsk_abc123', pane)

      const panes = useTerminalStore.getState().getPanesForTask('tsk_abc123')
      expect(panes).toHaveLength(1)
      expect(panes[0]).toEqual(pane)
    })

    it('addPane sets the pane as active', () => {
      const pane: TerminalPane = {
        id: 'pane-1',
        sessionName: 'kanban-tsk_abc123-0',
        title: 'Terminal 1'
      }
      useTerminalStore.getState().addPane('tsk_abc123', pane)
      expect(useTerminalStore.getState().getActivePaneForTask('tsk_abc123')).toBe('pane-1')
    })

    it('addPane appends to existing panes', () => {
      const pane1: TerminalPane = { id: 'pane-1', sessionName: 's1', title: 'Terminal 1' }
      const pane2: TerminalPane = { id: 'pane-2', sessionName: 's2', title: 'Terminal 2' }

      useTerminalStore.getState().addPane('tsk_abc123', pane1)
      useTerminalStore.getState().addPane('tsk_abc123', pane2)

      const panes = useTerminalStore.getState().getPanesForTask('tsk_abc123')
      expect(panes).toHaveLength(2)
      // Latest added pane becomes active
      expect(useTerminalStore.getState().getActivePaneForTask('tsk_abc123')).toBe('pane-2')
    })

    it('removePane removes a pane and updates active pane', () => {
      const pane1: TerminalPane = { id: 'pane-1', sessionName: 's1', title: 'Terminal 1' }
      const pane2: TerminalPane = { id: 'pane-2', sessionName: 's2', title: 'Terminal 2' }

      useTerminalStore.getState().addPane('tsk_abc123', pane1)
      useTerminalStore.getState().addPane('tsk_abc123', pane2)
      useTerminalStore.getState().removePane('tsk_abc123', 'pane-2')

      const panes = useTerminalStore.getState().getPanesForTask('tsk_abc123')
      expect(panes).toHaveLength(1)
      expect(panes[0].id).toBe('pane-1')
      // Active pane falls back to last remaining
      expect(useTerminalStore.getState().getActivePaneForTask('tsk_abc123')).toBe('pane-1')
    })

    it('removePane cleans up when last pane removed', () => {
      const pane: TerminalPane = { id: 'pane-1', sessionName: 's1', title: 'Terminal 1' }
      useTerminalStore.getState().addPane('tsk_abc123', pane)
      useTerminalStore.getState().removePane('tsk_abc123', 'pane-1')

      expect(useTerminalStore.getState().getPanesForTask('tsk_abc123')).toHaveLength(0)
      expect(useTerminalStore.getState().getActivePaneForTask('tsk_abc123')).toBeUndefined()
    })

    it('setActivePane changes the active pane', () => {
      const pane1: TerminalPane = { id: 'pane-1', sessionName: 's1', title: 'Terminal 1' }
      const pane2: TerminalPane = { id: 'pane-2', sessionName: 's2', title: 'Terminal 2' }

      useTerminalStore.getState().addPane('tsk_abc123', pane1)
      useTerminalStore.getState().addPane('tsk_abc123', pane2)
      useTerminalStore.getState().setActivePane('tsk_abc123', 'pane-1')

      expect(useTerminalStore.getState().getActivePaneForTask('tsk_abc123')).toBe('pane-1')
    })
  })

  describe('getters', () => {
    it('getPanesForTask returns empty array for unknown task', () => {
      expect(useTerminalStore.getState().getPanesForTask('unknown')).toEqual([])
    })

    it('getActivePaneForTask returns undefined for unknown task', () => {
      expect(useTerminalStore.getState().getActivePaneForTask('unknown')).toBeUndefined()
    })
  })
})
