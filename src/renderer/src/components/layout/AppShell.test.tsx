import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell } from './AppShell'

// Mock the Header component to avoid its store dependencies
vi.mock('./Header', () => ({
  Header: () => <div data-testid="mock-header">Header</div>
}))

describe('AppShell', () => {
  it('renders the Header component', () => {
    render(<AppShell><div>content</div></AppShell>)
    expect(screen.getByTestId('mock-header')).toBeTruthy()
  })

  it('renders children inside main element', () => {
    render(
      <AppShell>
        <div data-testid="child">Hello World</div>
      </AppShell>
    )
    expect(screen.getByTestId('child')).toBeTruthy()
    expect(screen.getByText('Hello World')).toBeTruthy()
  })

  it('wraps everything in a div with class "app"', () => {
    const { container } = render(<AppShell><span>test</span></AppShell>)
    const appDiv = container.firstChild as HTMLElement
    expect(appDiv.className).toBe('app')
  })

  it('renders children inside a main element with class "app-main"', () => {
    const { container } = render(<AppShell><span>inside</span></AppShell>)
    const main = container.querySelector('main')
    expect(main).toBeTruthy()
    expect(main!.className).toBe('app-main')
    expect(main!.textContent).toBe('inside')
  })

  it('renders multiple children', () => {
    render(
      <AppShell>
        <div data-testid="a">A</div>
        <div data-testid="b">B</div>
      </AppShell>
    )
    expect(screen.getByTestId('a')).toBeTruthy()
    expect(screen.getByTestId('b')).toBeTruthy()
  })
})
