import { act, fireEvent, render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { ANNOUNCE_EVERY_MS, ScanProgress } from '../src/components/ScanProgress'
import { fromFileListAsync } from '../src/lib/readFiles'
import { sgPack } from '../src/rules'
import type { WorkerLike } from '../src/worker/client'
import type { PageToWorker, WorkerToPage } from '../src/worker/protocol'
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

/** WCAG 2.x A/AA rules. Contrast needs real layout, so it is checked in Chromium instead. */
async function violations(node: Element) {
  const result = await axe.run(node, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

afterEach(() => vi.useRealTimers())

describe('accessibility', () => {
  it('has no axe violations before a scan', async () => {
    const { container } = render(<App createWorker={() => new FakeWorker()} />)
    expect(await violations(container)).toEqual([])
  })

  it('has no axe violations on a result', async () => {
    const { container } = render(<App createWorker={() => new FakeWorker()} />)
    fireEvent.change(screen.getByLabelText('Choose files'), {
      target: { files: [new File(['id S8412369B, call 9123 4567'], 'a.txt')] },
    })
    expect(await screen.findByRole('heading', { name: 'Likely blocked' })).toBeInTheDocument()
    expect(await violations(container)).toEqual([])
  })

  it('announces scan progress at most every ANNOUNCE_EVERY_MS, not per file', () => {
    vi.useFakeTimers()
    const { rerender } = render(<ScanProgress done={0} total={1000} onCancel={() => {}} />)
    const live = screen.getByRole('status')
    expect(live).toHaveTextContent('Scanning file 1 of 1000')
    for (let done = 1; done <= 50; done++) rerender(<ScanProgress done={done} total={1000} onCancel={() => {}} />)
    expect(live).toHaveTextContent('Scanning file 1 of 1000')
    act(() => vi.advanceTimersByTime(ANNOUNCE_EVERY_MS))
    rerender(<ScanProgress done={51} total={1000} onCancel={() => {}} />)
    expect(live).toHaveTextContent('Scanning file 52 of 1000')
  })
})

describe('large picks', () => {
  it('builds the file list in batches, yielding to the page between them', async () => {
    const spy = vi.spyOn(globalThis, 'setTimeout')
    const files = Array.from({ length: 250 }, (_, i) => new File(['x'], `f${i}.txt`))
    const out = await fromFileListAsync(files)
    expect(out).toHaveLength(250)
    expect(out[249]!.path).toBe('f249.txt')
    expect(spy.mock.calls.filter((c) => c[1] === 0).length).toBeGreaterThanOrEqual(2)
    spy.mockRestore()
  })
})
