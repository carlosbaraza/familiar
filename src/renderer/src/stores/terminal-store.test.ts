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
        sessionName: 'familiar-tsk_abc123-0',
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
        sessionName: 'familiar-tsk_abc123-0',
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
        sessionName: 'familiar-tsk_abc123-0',
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
        sessionName: 'familiar-tsk_abc123-0',
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

  describe('clearSessionsForNonActiveTasks', () => {
    it('removes sessions, panes, and active pane entries for non-active tasks', () => {
      // Set up two tasks with sessions and panes
      const session1: TerminalSession = {
        id: 'sess-1',
        taskId: 'tsk_aaa',
        paneIndex: 0,
        sessionName: 'familiar-tsk_aaa-0',
        isActive: true
      }
      const session2: TerminalSession = {
        id: 'sess-2',
        taskId: 'tsk_bbb',
        paneIndex: 0,
        sessionName: 'familiar-tsk_bbb-0',
        isActive: true
      }
      const pane1: TerminalPane = { id: 'pane-1', sessionName: 'familiar-tsk_aaa-0', title: 'T1' }
      const pane2: TerminalPane = { id: 'pane-2', sessionName: 'familiar-tsk_bbb-0', title: 'T2' }

      const store = useTerminalStore.getState()
      store.addSession(session1)
      store.addSession(session2)
      store.addPane('tsk_aaa', pane1)
      store.addPane('tsk_bbb', pane2)

      // Only tsk_aaa is active
      useTerminalStore.getState().clearSessionsForNonActiveTasks(['tsk_aaa'])

      const state = useTerminalStore.getState()
      expect(state.sessions.size).toBe(1)
      expect(state.sessions.has('sess-1')).toBe(true)
      expect(state.sessions.has('sess-2')).toBe(false)

      expect(state.panesByTask.has('tsk_aaa')).toBe(true)
      expect(state.panesByTask.has('tsk_bbb')).toBe(false)

      expect(state.activePaneByTask.has('tsk_aaa')).toBe(true)
      expect(state.activePaneByTask.has('tsk_bbb')).toBe(false)
    })

    it('keeps all entries when all tasks are active', () => {
      const pane1: TerminalPane = { id: 'pane-1', sessionName: 's1', title: 'T1' }
      const pane2: TerminalPane = { id: 'pane-2', sessionName: 's2', title: 'T2' }

      const store = useTerminalStore.getState()
      store.addPane('tsk_aaa', pane1)
      store.addPane('tsk_bbb', pane2)

      useTerminalStore.getState().clearSessionsForNonActiveTasks(['tsk_aaa', 'tsk_bbb'])

      const state = useTerminalStore.getState()
      expect(state.panesByTask.size).toBe(2)
      expect(state.activePaneByTask.size).toBe(2)
    })

    it('clears everything when no task IDs are active', () => {
      const session: TerminalSession = {
        id: 'sess-1',
        taskId: 'tsk_aaa',
        paneIndex: 0,
        sessionName: 'familiar-tsk_aaa-0',
        isActive: true
      }
      const pane: TerminalPane = { id: 'pane-1', sessionName: 's1', title: 'T1' }

      const store = useTerminalStore.getState()
      store.addSession(session)
      store.addPane('tsk_aaa', pane)

      useTerminalStore.getState().clearSessionsForNonActiveTasks([])

      const state = useTerminalStore.getState()
      expect(state.sessions.size).toBe(0)
      expect(state.panesByTask.size).toBe(0)
      expect(state.activePaneByTask.size).toBe(0)
    })

    it('is a no-op when store is already empty', () => {
      useTerminalStore.getState().clearSessionsForNonActiveTasks(['tsk_aaa'])

      const state = useTerminalStore.getState()
      expect(state.sessions.size).toBe(0)
      expect(state.panesByTask.size).toBe(0)
      expect(state.activePaneByTask.size).toBe(0)
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
