import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore } from '@renderer/stores/board-store'

describe('useBoardStore', () => {
  beforeEach(() => {
    useBoardStore.setState({
      draggedTaskId: null,
      dragOverColumn: null
    })
  })

  describe('setDraggedTask', () => {
    it('sets draggedTaskId to the given value', () => {
      useBoardStore.getState().setDraggedTask('tsk_abc')
      expect(useBoardStore.getState().draggedTaskId).toBe('tsk_abc')
    })

    it('clears draggedTaskId when set to null', () => {
      useBoardStore.getState().setDraggedTask('tsk_abc')
      useBoardStore.getState().setDraggedTask(null)
      expect(useBoardStore.getState().draggedTaskId).toBeNull()
    })
  })

  describe('setDragOverColumn', () => {
    it('sets dragOverColumn to the given status', () => {
      useBoardStore.getState().setDragOverColumn('in-progress')
      expect(useBoardStore.getState().dragOverColumn).toBe('in-progress')
    })

    it('clears dragOverColumn when set to null', () => {
      useBoardStore.getState().setDragOverColumn('todo')
      useBoardStore.getState().setDragOverColumn(null)
      expect(useBoardStore.getState().dragOverColumn).toBeNull()
    })
  })
})
