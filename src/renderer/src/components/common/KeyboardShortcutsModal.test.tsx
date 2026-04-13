import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
import { useUIStore } from '@renderer/stores/ui-store'

describe('KeyboardShortcutsModal', () => {
  beforeEach(() => {
    useUIStore.setState({ shortcutsModalOpen: false })
  })

  it('renders nothing when closed', () => {
    const { container } = render(<KeyboardShortcutsModal />)
    expect(container.firstChild).toBeNull()
  })

  it('renders modal content when open', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    expect(screen.getByText('Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Workflows')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Board Navigation')).toBeInTheDocument()
    expect(screen.getByText('Task Detail Navigation')).toBeInTheDocument()
    expect(screen.getByText('Task Actions')).toBeInTheDocument()
  })

  it('displays shortcut descriptions', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    expect(screen.getByText('Open command palette')).toBeInTheDocument()
    expect(screen.getByText('Move down in column')).toBeInTheDocument()
    expect(screen.getByText('Move to Todo')).toBeInTheDocument()
  })

  it('shows new task detail navigation shortcuts', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    expect(screen.getByText('Focus terminal')).toBeInTheDocument()
    expect(screen.getByText('Title → Notes')).toBeInTheDocument()
    expect(screen.getByText('Notes → Title')).toBeInTheDocument()
  })

  it('expands shortcut detail on click', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    // The "Close current panel" shortcut has a detail
    const row = screen.getByText(/Close current panel/).closest('div')!
    fireEvent.click(row)

    expect(screen.getByText(/Layered dismiss/)).toBeInTheDocument()
  })

  it('switches to workflows tab', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    fireEvent.click(screen.getByTestId('workflows-tab'))

    expect(screen.getByText('Quick Task Review')).toBeInTheDocument()
    expect(screen.getByText('Triage & Prioritize')).toBeInTheDocument()
    expect(screen.getByText('Bulk Move Tasks')).toBeInTheDocument()
  })

  it('closes when clicking overlay', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    const overlay = screen.getByTestId('shortcuts-overlay')
    fireEvent.click(overlay)

    expect(useUIStore.getState().shortcutsModalOpen).toBe(false)
  })

  it('closes when pressing Escape', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(useUIStore.getState().shortcutsModalOpen).toBe(false)
  })

  it('closes when clicking close button', () => {
    useUIStore.setState({ shortcutsModalOpen: true })
    render(<KeyboardShortcutsModal />)

    // Close button contains the X SVG icon
    const svgIcon = screen.getByTestId('shortcuts-overlay').querySelector('svg')!
    const closeButton = svgIcon.closest('button')!
    fireEvent.click(closeButton)

    expect(useUIStore.getState().shortcutsModalOpen).toBe(false)
  })
})
