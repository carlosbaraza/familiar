import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IconPicker, LucideIconByName } from './IconPicker'

// Mock lucide-react with a small set of test icons
// Factory must not reference outer variables (hoisted by vitest)
vi.mock('lucide-react', () => {
  const makeMockIcon = (name: string) => {
    const Icon = ({ size }: { size?: number }) => (
      <svg data-testid={`mock-icon-${name}`} width={size} height={size} />
    )
    Icon.displayName = name
    return Icon
  }

  return {
    icons: {
      Play: makeMockIcon('Play'),
      Rocket: makeMockIcon('Rocket'),
      Settings: makeMockIcon('Settings'),
      Search: makeMockIcon('Search'),
      Home: makeMockIcon('Home')
    }
  }
})

describe('IconPicker', () => {
  const defaultProps = {
    onSelect: vi.fn(),
    onClose: vi.fn(),
    anchorRect: new DOMRect(100, 100, 50, 30)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the search input with placeholder', () => {
    render(<IconPicker {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search icons...')).toBeInTheDocument()
  })

  it('renders icon buttons', () => {
    render(<IconPicker {...defaultProps} />)
    expect(screen.getByTitle('play')).toBeInTheDocument()
    expect(screen.getByTitle('rocket')).toBeInTheDocument()
    expect(screen.getByTitle('settings')).toBeInTheDocument()
    expect(screen.getByTitle('search')).toBeInTheDocument()
    expect(screen.getByTitle('home')).toBeInTheDocument()
  })

  it('filters icons based on search query', () => {
    render(<IconPicker {...defaultProps} />)

    const input = screen.getByPlaceholderText('Search icons...')
    fireEvent.change(input, { target: { value: 'rock' } })

    expect(screen.getByTitle('rocket')).toBeInTheDocument()
    expect(screen.queryByTitle('play')).not.toBeInTheDocument()
    expect(screen.queryByTitle('settings')).not.toBeInTheDocument()
  })

  it('shows "No icons found" when search has no matches', () => {
    render(<IconPicker {...defaultProps} />)

    const input = screen.getByPlaceholderText('Search icons...')
    fireEvent.change(input, { target: { value: 'zzzznotfound' } })

    expect(screen.getByText('No icons found')).toBeInTheDocument()
  })

  it('shows icon count text', () => {
    render(<IconPicker {...defaultProps} />)
    expect(screen.getByText('5 icons')).toBeInTheDocument()
  })

  it('shows matching count when searching', () => {
    render(<IconPicker {...defaultProps} />)

    const input = screen.getByPlaceholderText('Search icons...')
    fireEvent.change(input, { target: { value: 'se' } })

    // "search" and "settings" should match
    expect(screen.getByText(/icon.*matching "se"/)).toBeInTheDocument()
  })

  it('calls onSelect with kebab-case name and onClose when an icon is clicked', () => {
    render(<IconPicker {...defaultProps} />)

    fireEvent.click(screen.getByTitle('rocket'))

    expect(defaultProps.onSelect).toHaveBeenCalledWith('rocket')
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('highlights selected icon', () => {
    render(<IconPicker {...defaultProps} selectedIcon="rocket" />)

    const rocketButton = screen.getByTitle('rocket')
    expect(rocketButton.style.backgroundColor).toBe('rgba(99, 102, 241, 0.15)')
  })

  it('calls onClose when Escape key is pressed', () => {
    render(<IconPicker {...defaultProps} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when clicking outside the popover', () => {
    render(<IconPicker {...defaultProps} />)

    fireEvent.mouseDown(document.body)
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when clicking inside the popover', () => {
    render(<IconPicker {...defaultProps} />)

    const input = screen.getByPlaceholderText('Search icons...')
    fireEvent.mouseDown(input)

    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })
})

describe('LucideIconByName', () => {
  it('renders an icon by kebab-case name', () => {
    render(<LucideIconByName name="play" />)
    expect(screen.getByTestId('mock-icon-Play')).toBeInTheDocument()
  })

  it('renders with specified size', () => {
    render(<LucideIconByName name="play" size={20} />)
    const icon = screen.getByTestId('mock-icon-Play')
    expect(icon.getAttribute('width')).toBe('20')
  })

  it('returns null for unknown icon names', () => {
    const { container } = render(<LucideIconByName name="totally-nonexistent-icon" />)
    expect(container.innerHTML).toBe('')
  })
})
