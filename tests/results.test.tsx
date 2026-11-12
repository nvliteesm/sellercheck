import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { SHOWN_ROWS } from '../src/components/FindingList'
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

  it('opens on the "Likely to block" tab, grouped by file, with label, lines, masked value and fix', async () => {
    await scanDummies()
    const blockTab = screen.getByRole('tab', { name: 'Likely to block 5' })
    expect(blockTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Review 13' })).toHaveAttribute('aria-selected', 'false')

    const panel = within(screen.getByRole('tabpanel'))
    const files = panel.getAllByRole('article').map((a) => a.getAttribute('aria-label'))
    expect(files).toEqual(['dummy-config.js', 'dummy-customers.csv'])

    const config = within(panel.getByRole('article', { name: 'dummy-config.js' }))
    const key = within(config.getByRole('list', { name: 'Cloud access key found' }))
    const row = within(key.getByRole('listitem'))
    expect(row.getByText('Line 8')).toBeInTheDocument()
    expect(row.getByText('AKIA••••••••••••••LE')).toBeInTheDocument()
    expect(config.getByText('Service token')).toBeInTheDocument()
    expect(config.getAllByText(/known credential format/)).toHaveLength(2)
    expect(config.getByText(/deactivate the key/)).toBeInTheDocument()
  })

  it('shows each finding on its own line under one category, with one fix', async () => {
    await scanDummies()
    const csv = within(screen.getByRole('article', { name: 'dummy-customers.csv' }))
    expect(csv.getByText('NRIC or FIN')).toBeInTheDocument()
    expect(csv.getByText('×3')).toBeInTheDocument()
    const rows = within(csv.getByRole('list', { name: 'NRIC or FIN found' })).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual(['Line 2•••••369B', 'Line 3•••••542B', 'Line 4•••••817R'])
    expect(csv.getAllByText(/random or hashed ID/)).toHaveLength(1)
    expect(csv.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument()
  })

  it('shows the first SHOWN_ROWS lines of a category, then "Show all"', async () => {
    render(<App createWorker={() => new FakeWorker()} />)
    const phones = ['9123 4567', '9123 4568', '9123 4569', '9123 4570', '9123 4571']
    pick([new File([phones.map((p) => `call ${p}`).join('\n')], 'chat.txt')])
    await screen.findByRole('heading', { name: 'Needs review' })
    const list = screen.getByRole('list', { name: 'Singapore phone number found' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(SHOWN_ROWS)
    const more = screen.getByRole('button', { name: 'Show all 5' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    expect(more).toHaveAttribute('aria-controls', list.id)
    fireEvent.click(more)
    expect(within(list).getAllByRole('listitem').map((r) => r.textContent?.slice(0, 6))).toEqual([
      'Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(SHOWN_ROWS)
  })

  it('switches tabs by click and by arrow keys', async () => {
    await scanDummies()
    const blockTab = screen.getByRole('tab', { name: 'Likely to block 5' })
    const reviewTab = screen.getByRole('tab', { name: 'Review 13' })
    fireEvent.click(reviewTab)
    expect(reviewTab).toHaveAttribute('aria-selected', 'true')
    expect(reviewTab).toHaveFocus()
    const panel = within(screen.getByRole('tabpanel'))
    expect(panel.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual([
      'dummy-config.js',
      'dummy-customers.csv',
      'dummy-support-chat.txt',
    ])
    expect(panel.queryByText('NRIC or FIN')).not.toBeInTheDocument()

    fireEvent.keyDown(reviewTab, { key: 'ArrowRight' })
    expect(blockTab).toHaveAttribute('aria-selected', 'true')
    expect(blockTab).toHaveFocus()
    expect(blockTab).toHaveAttribute('tabindex', '0')
    expect(reviewTab).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(blockTab, { key: 'End' })
    expect(reviewTab).toHaveFocus()
  })

  it('opens on Review when nothing is likely to block', async () => {
    render(<App createWorker={() => new FakeWorker()} />)
    pick([new File(['call 9123 4567'], 'a.txt')])
    expect(await screen.findByRole('heading', { name: 'Needs review' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Review 1' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Likely to block 0' }))
    expect(screen.getByText('Nothing likely to block.')).toBeInTheDocument()
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
