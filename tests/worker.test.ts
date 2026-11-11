import { describe, expect, it, vi } from 'vitest'
import { sgPack } from '../src/rules'
import { type WorkerLike, startScan } from '../src/worker/client'
import {
  type DoneMessage,
  type PageToWorker,
  type ScanFile,
  type WorkerToPage,
  isWorkerToPage,
} from '../src/worker/protocol'
import { runScan } from '../src/worker/scan'
import dummyConfig from './fixtures/dummy-config.js?raw'
import dummyCustomers from './fixtures/dummy-customers.csv?raw'
import dummyReadme from './fixtures/dummy-README.md?raw'
import dummyChat from './fixtures/dummy-support-chat.txt?raw'

const fixtures: ScanFile[] = [
  { path: 'dummy-config.js', text: dummyConfig },
  { path: 'dummy-customers.csv', text: dummyCustomers },
  { path: 'dummy-support-chat.txt', text: dummyChat },
  { path: 'dummy-README.md', text: dummyReadme },
]

function collect(files: readonly ScanFile[], skipped: PageToWorker['skipped'] = []): WorkerToPage[] {
  const out: WorkerToPage[] = []
  runScan({ type: 'scan', files, skipped }, (m) => out.push(m), sgPack)
  return out
}

const doneOf = (msgs: WorkerToPage[]) => msgs.at(-1) as DoneMessage

describe('runScan on the four dummy files (PRD v2 appendix)', () => {
  const msgs = collect(fixtures)

  it('ends with done: 4 scanned, 0 skipped, 5 blockers, 13 review, 1 generic email, Likely blocked', () => {
    expect(doneOf(msgs)).toEqual({
      type: 'done',
      totals: { blocker: 5, review: 13 },
      scanned: 4,
      skipped: 0,
      skippedByReason: { 'ignored-folder': 0, binary: 0, 'too-large': 0, 'file-cap': 0, unreadable: 0 },
      genericEmailsSkipped: 1,
      verdict: 'likely-blocked',
    })
  })

  it('posts start, findings, then progress for each file, in order', () => {
    expect(msgs.filter((m) => m.type === 'start').map((m) => m.type === 'start' && m.path)).toEqual(
      fixtures.map((f) => f.path),
    )
    expect(msgs.filter((m) => m.type === 'finding')).toHaveLength(18)
    const progress = msgs.filter((m) => m.type === 'progress')
    expect(progress.map((m) => m.type === 'progress' && m.done)).toEqual([1, 2, 3, 4])
    expect(progress.map((m) => m.type === 'progress' && m.findingsInFile)).toEqual([3, 12, 3, 0])
    // Every finding sits between its own file's start and progress.
    let current = ''
    for (const m of msgs) {
      if (m.type === 'start') current = m.path
      if (m.type === 'finding') expect(m.finding.path).toBe(current)
    }
  })

  it('every message is valid under the shared protocol', () => {
    for (const m of msgs) expect(isWorkerToPage(m), JSON.stringify(m)).toBe(true)
  })

  it('FR7: no message the worker posts holds a full key, token, NRIC, password, passport or email', () => {
    const posted = JSON.stringify(msgs)
    for (const raw of [
      'AKIAIOSFODNN7EXAMPLE',
      'sk_live_FAKE_0000_DUMMY_0000_NOT_REAL',
      'Kopi-Siew-Dai-2026!',
      'S8412369B',
      'T0176542B',
      'G5523817R',
      'K1234567X',
      'meiling.tan@example.com',
      'wei.jie.lim@example.com',
      '9123 4567',
      '9876 5432',
      'Singapore 123456',
    ]) {
      expect(posted).not.toContain(raw)
    }
  })
})

describe('runScan counts and verdicts', () => {
  it('a clean file gives "no issues" with scanned and skipped counts', () => {
    const done = doneOf(
      collect(
        [{ path: 'notes.md', text: 'Monthly sales by category.' }],
        [
          { path: 'node_modules/x.js', reason: 'ignored-folder' },
          { path: 'logo.png', reason: 'binary' },
          { path: 'dump.sql', reason: 'too-large' },
        ],
      ),
    )
    expect(done).toMatchObject({ scanned: 1, skipped: 3, verdict: 'no-issues', totals: { blocker: 0, review: 0 } })
    expect(done.skippedByReason).toMatchObject({ 'ignored-folder': 1, binary: 1, 'too-large': 1 })
  })

  it('review items only give Needs review', () => {
    expect(doneOf(collect([fixtures[2]!])).verdict).toBe('needs-review')
  })

  it('no files still ends with done', () => {
    expect(collect([])).toEqual([expect.objectContaining({ type: 'done', scanned: 0, verdict: 'no-issues' })])
  })
})

class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent<unknown>) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  posted: PageToWorker[] = []
  terminated = false
  postMessage(m: PageToWorker) {
    this.posted.push(m)
  }
  terminate() {
    this.terminated = true
  }
  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent<unknown>)
  }
}

describe('startScan (page side)', () => {
  it('sends scan only after ready, then delivers results and terminates on done', () => {
    const w = new FakeWorker()
    const got: WorkerToPage[] = []
    startScan(fixtures, [], { onMessage: (m) => got.push(m) }, () => w)
    expect(w.posted).toEqual([])

    w.emit({ type: 'ready' })
    expect(w.posted).toEqual([{ type: 'scan', files: fixtures, skipped: [] }])

    // Play the real scan back through the fake worker.
    for (const m of collect(fixtures)) w.emit(m)
    expect(got.at(-1)).toMatchObject({ type: 'done', verdict: 'likely-blocked' })
    expect(got.some((m) => m.type === 'ready')).toBe(false)
    expect(w.terminated).toBe(true)
  })

  it('cancel terminates the worker and no further results arrive (FR4)', () => {
    const w = new FakeWorker()
    const onMessage = vi.fn()
    const scan = startScan(fixtures, [], { onMessage }, () => w)
    w.emit({ type: 'ready' })
    const msgs = collect(fixtures)
    w.emit(msgs[0])
    scan.cancel()
    expect(w.terminated).toBe(true)
    for (const m of msgs.slice(1)) w.emit(m)
    expect(onMessage).toHaveBeenCalledTimes(1)
  })

  it('a malformed message stops the scan and reports an error', () => {
    const w = new FakeWorker()
    const onError = vi.fn()
    const onMessage = vi.fn()
    startScan(fixtures, [], { onMessage, onError }, () => w)
    w.emit({ type: 'finding', finding: { raw: 'S8412369B' } })
    expect(onError).toHaveBeenCalledOnce()
    expect(onMessage).not.toHaveBeenCalled()
    expect(w.terminated).toBe(true)
  })

  it('a worker error stops the scan and reports it', () => {
    const w = new FakeWorker()
    const onError = vi.fn()
    startScan(fixtures, [], { onMessage: vi.fn(), onError }, () => w)
    w.onerror?.(new ErrorEvent('error'))
    expect(onError).toHaveBeenCalledOnce()
    expect(w.terminated).toBe(true)
  })
})

describe('scanner.worker entry', () => {
  it('posts ready on load, ignores bad input, and answers scan with done', async () => {
    const posted: WorkerToPage[] = []
    const scope: { onmessage: ((e: MessageEvent<unknown>) => void) | null; postMessage: (m: WorkerToPage) => void } = {
      onmessage: null,
      postMessage: (m) => posted.push(m),
    }
    vi.stubGlobal('self', scope)
    try {
      await import('../src/worker/scanner.worker')
      expect(posted).toEqual([{ type: 'ready' }])

      scope.onmessage?.({ data: { type: 'scan', files: 'nope' } } as MessageEvent<unknown>)
      expect(posted).toHaveLength(1)

      scope.onmessage?.({ data: { type: 'scan', files: fixtures, skipped: [] } } as MessageEvent<unknown>)
      expect(posted.at(-1)).toMatchObject({ type: 'done', totals: { blocker: 5, review: 13 } })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
