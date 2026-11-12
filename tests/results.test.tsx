import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { NetworkProof, PROOF_URL, tryToSendData } from '../src/components/NetworkProof'
import { NOTICE_TEXT } from '../src/lib/report'
import { sgPack } from '../src/rules'
import type { WorkerLike } from '../src/worker/client'
import type { PageToWorker, WorkerToPage } from '../src/worker/protocol'
import { runScan } from '../src/worker/scan'
import dummyConfig from './fixtures/dummy-config.js?raw'
import dummyCustomers from './fixtures/dummy-customers.csv?raw'
import dummyReadme from './fixtures/dummy-README.md?raw'
import dummyChat from './fixtures/dummy-support-chat.txt?raw'

class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent<unknown>) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  constructor() {
    setTimeout(() => this.emit({ type: 'ready' }))
  }
  postMessage(m: PageToWorker) {
    setTimeout(() => runScan(m, (out) => this.emit(out), sgPack))
  }
  terminate() {}
  private emit(data: WorkerToPage) {
    this.onmessage?.({ data } as MessageEvent<unknown>)
  }
}

const pick = (files: File[]) => fireEvent.change(screen.getByLabelText('Choose files'), { target: { files } })

async function scanDummies() {
  render(<App createWorker={() => new FakeWorker()} />)
  pick([
    new File([dummyConfig], 'dummy-config.js'),
    new File([dummyCustomers], 'dummy-customers.csv'),
    new File([dummyChat], 'dummy-support-chat.txt'),
    new File([dummyReadme], 'dummy-README.md'),
  ])
  return screen.findByRole('heading', { level: 2, name: 'Likely blocked' })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('results view', () => {
  it('shows the verdict with counts and moves focus to it', async () => {
    const heading = await scanDummies()
    expect(heading).toHaveFocus()
    expect(screen.getByText('4 scanned · 0 skipped')).toBeInTheDocument()
  })

  it('groups findings by file, blockers first, each with all seven FR5 fields', async () => {
    await scanDummies()
    const files = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))
    expect(files).toEqual(['dummy-config.js', 'dummy-customers.csv', 'dummy-support-chat.txt'])

    const config = within(screen.getByRole('article', { name: 'dummy-config.js' }))
    const items = config.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    const first = within(items[0]!)
    expect(first.getByText('Line 8')).toBeInTheDocument()
    expect(first.getByText('Likely to block')).toBeInTheDocument()
    expect(first.getByText('Cloud access key')).toBeInTheDocument()
    expect(first.getByText('AKIA••••••••••••••LE')).toBeInTheDocument()
    expect(first.getByText(/known credential format/)).toBeInTheDocument()
    expect(first.getByText(/deactivate the key/)).toBeInTheDocument()
  })

  it('merges repeated findings of one rule in a file into one row', async () => {
    await scanDummies()
    const csv = within(screen.getByRole('article', { name: 'dummy-customers.csv' }))
    const rows = csv.getAllByRole('listitem')
    expect(rows).toHaveLength(4)
    const nric = within(rows[0]!)
    expect(nric.getByText('NRIC or FIN')).toBeInTheDocument()
    expect(nric.getByText('×3')).toBeInTheDocument()
    expect(nric.getByText('Lines 2, 3, 4')).toBeInTheDocument()
    expect(nric.getByText(/random or hashed ID/)).toBeInTheDocument()
  })

  it('never renders a raw secret or NRIC', async () => {
    await scanDummies()
    const html = document.body.innerHTML
    for (const raw of ['AKIAIOSFODNN7EXAMPLE', 'sk_live_FAKE_0000_DUMMY_0000_NOT_REAL', 'Kopi-Siew-Dai-2026!', 'S8412369B']) {
      expect(html).not.toContain(raw)
    }
  })

  it('copies the report as plain text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await scanDummies()
    fireEvent.click(screen.getByRole('button', { name: 'Copy report' }))
    expect(await screen.findByText('Report copied.')).toBeInTheDocument()
    const text = writeText.mock.calls[0]![0] as string
    expect(text).toContain('Verdict: Likely blocked (4 scanned · 0 skipped)')
    expect(text.match(/^Line \d+:/gm)).toHaveLength(18)
  })

  it('shows the report to copy by hand when the clipboard is blocked', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.reject(new Error('denied')) } })
    await scanDummies()
    fireEvent.click(screen.getByRole('button', { name: 'Copy report' }))
    const box = (await screen.findByLabelText('Report text')) as HTMLTextAreaElement
    expect(box.value).toContain('Verdict: Likely blocked')
  })
})

describe('always visible', () => {
  it('shows the notice, known gaps and unofficial label before and after a scan (FR9)', async () => {
    render(<App createWorker={() => new FakeWorker()} />)
    expect(screen.getByText(NOTICE_TEXT)).toBeInTheDocument()
    pick([new File(['Monthly sales by category.'], 'clean.md')])
    expect(await screen.findByRole('heading', { name: 'No issues found in scanned files' })).toBeInTheDocument()
    expect(screen.getByText('1 scanned · 0 skipped')).toBeInTheDocument()
    expect(screen.getByText(NOTICE_TEXT)).toBeInTheDocument()
    expect(screen.getByText('Unofficial tool')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/HUD|DataVendor/)
    expect(screen.getByText('What this check does not cover')).toBeInTheDocument()
    for (const gap of sgPack.knownGaps) expect(screen.getByText(`${gap.label}.`)).toBeInTheDocument()
  })
})

describe('"Try to send data"', () => {
  it('a failure without a policy violation is not counted as blocked', async () => {
    const r = await tryToSendData(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(r).toEqual({ kind: 'unprotected' })
  })

  it('targets a .invalid address that can never reach a server', () => {
    expect(new URL(PROOF_URL).hostname.endsWith('.invalid')).toBe(true)
  })

  it('reports the directive from the security policy violation', async () => {
    const r = await tryToSendData(() => {
      const e = new Event('securitypolicyviolation') as Event & { effectiveDirective: string }
      e.effectiveDirective = 'connect-src'
      document.dispatchEvent(e)
      return Promise.reject(new TypeError('Failed to fetch'))
    })
    expect(r).toEqual({ kind: 'blocked', detail: 'Blocked by the security policy (connect-src).' })
  })

  it('warns when the request was not blocked', async () => {
    expect(await tryToSendData(() => Promise.resolve(new Response()))).toEqual({ kind: 'unprotected' })
  })

  it('shows the result next to the button', async () => {
    render(<NetworkProof send={async () => ({ kind: 'blocked', detail: 'Blocked by the security policy (connect-src).' })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try to send data' }))
    expect(await screen.findByText(/Nothing was sent\./)).toBeInTheDocument()
  })
})
