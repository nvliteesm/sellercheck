import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { readIntake } from '../src/lib/readFiles'
import { SAMPLE_FILES, sampleSource } from '../src/lib/samples'
import { sgPack, scanText, totalsOf } from '../src/rules'
import type { WorkerLike } from '../src/worker/client'
import type { DoneMessage, PageToWorker, WorkerToPage } from '../src/worker/protocol'
import { runScan } from '../src/worker/scan'

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

const perFile = (name: string) => {
  const file = SAMPLE_FILES.find((f) => f.path.endsWith(`/${name}`))!
  return totalsOf(scanText(file.path, file.text, sgPack).findings)
}

describe('bundled sample files', () => {
  it('has the five made-up files, all under sample/', () => {
    expect(SAMPLE_FILES.map((f) => f.path)).toEqual([
      'sample/orders-export.jsonl',
      'sample/app-server.log',
      'sample/shop-config.yaml',
      'sample/customers-dump.sql',
      'sample/delivery_fee.py',
    ])
    for (const f of SAMPLE_FILES) expect(f.text.length).toBeGreaterThan(0)
  })

  it('gives the expected counts per file', () => {
    expect(perFile('orders-export.jsonl')).toEqual({ blocker: 2, review: 9 })
    expect(perFile('app-server.log')).toEqual({ blocker: 1, review: 3 })
    expect(perFile('shop-config.yaml')).toEqual({ blocker: 0, review: 4 })
    expect(perFile('customers-dump.sql')).toEqual({ blocker: 3, review: 4 })
    expect(perFile('delivery_fee.py')).toEqual({ blocker: 0, review: 0 })
  })

  it('all five through intake and the scan give 6 to block, 20 to review, 2 role emails skipped', async () => {
    const source = sampleSource()
    const intake = await readIntake(source.entries, source.skipped)
    expect(intake.skipped).toEqual([])
    const out: WorkerToPage[] = []
    runScan({ type: 'scan', files: intake.files, skipped: intake.skipped }, (m) => out.push(m), sgPack)
    const done = out.at(-1) as DoneMessage
    expect(done).toMatchObject({
      type: 'done',
      scanned: 5,
      skipped: 0,
      totals: { blocker: 6, review: 20 },
      genericEmailsSkipped: 2,
      verdict: 'likely-blocked',
    })
  })
})

describe('"Try a sample" button', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('scans the samples without any network request and shows the verdict', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    render(<App createWorker={() => new FakeWorker()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try a sample' }))
    expect(await screen.findByRole('heading', { name: 'Likely blocked' })).toBeInTheDocument()
    expect(screen.getByText('5 scanned · 0 skipped')).toBeInTheDocument()
    expect(screen.getByText('6 likely to block · 20 to review')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('is only on the start screen, not in the "Check other files" row', async () => {
    render(<App createWorker={() => new FakeWorker()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try a sample' }))
    await screen.findByRole('heading', { name: 'Likely blocked' })
    const row = screen.getByRole('region', { name: 'Add files to check' })
    expect(within(row).queryByRole('button', { name: 'Try a sample' })).toBeNull()
  })
})
