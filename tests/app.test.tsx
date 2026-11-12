import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'

describe('App scaffold', () => {
  it('shows the title and the unofficial label', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'SellerCheck' })).toBeInTheDocument()
    expect(screen.getByText('Unofficial tool')).toBeInTheDocument()
  })

  it('names no outside company in the page text', () => {
    render(<App />)
    expect(document.body.textContent).not.toMatch(/HUD|DataVendor/)
  })

  it('says a clean result is not permission to sell or legal advice', () => {
    render(<App />)
    expect(screen.getByText(/not legal advice.*not permission to sell data/i)).toBeInTheDocument()
  })
})
