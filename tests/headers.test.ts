import { describe, expect, it } from 'vitest'
import vercelJson from '../vercel.json'

// Policy text copied from the PRD (Non-functional requirements). Change both together.
const PRD_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; worker-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"

type Header = { key: string; value: string }
const vercel = vercelJson as { headers: { source: string; headers: Header[] }[] }
const rule = vercel.headers.find((h) => h.source === '/(.*)')

describe('vercel.json security headers', () => {
  it('applies to every path', () => {
    expect(rule).toBeDefined()
  })

  it('sends the CSP exactly as written in the PRD', () => {
    expect(rule?.headers.find((h) => h.key === 'Content-Security-Policy')?.value).toBe(PRD_CSP)
  })

  it.each(['X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options', 'Permissions-Policy'])(
    'sends %s',
    (key) => {
      expect(rule?.headers.some((h) => h.key === key)).toBe(true)
    },
  )
})
