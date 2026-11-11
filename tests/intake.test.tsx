import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App, { CANCELLED_TEXT } from '../src/App'
import { FOLDER_DROP_FALLBACK } from '../src/components/DropZone'
import { sgPack } from '../src/rules'
import type { WorkerLike } from '../src/worker/client'
import type { PageToWorker, WorkerToPage } from '../src/worker/protocol'
import { runScan } from '../src/worker/scan'
import dummyConfig from './fixtures/dummy-config.js?raw'
import dummyCustomers from './fixtures/dummy-customers.csv?raw'
import dummyReadme from './fixtures/dummy-README.md?raw'
import dummyChat from './fixtures/dummy-support-chat.txt?raw'

/** A fake worker that answers like the real one, or stays silent after `ready` when `hang` is set. */
class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent<unknown>) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  posted: PageToWorker[] = []
  terminated = false
  private readonly hang: boolean
  constructor(hang = false) {
    this.hang = hang
    setTimeout(() => this.emit({ type: 'ready' }))
  }
  postMessage(m: PageToWorker) {
    this.posted.push(m)
    if (this.hang) return
    setTimeout(() => runScan(m, (out) => this.emit(out), sgPack))
  }
  terminate() {
    this.terminated = true
  }
  private emit(data: WorkerToPage) {
    this.onmessage?.({ data } as MessageEvent<unknown>)
  }
}

const asFile = (name: string, text: string, relativePath?: string) => {
  const f = new File([text], name)
  if (relativePath) Object.defineProperty(f, 'webkitRelativePath', { value: relativePath })
  return f
}

const pick = (files: File[]) => {
  const input = screen.getByLabelText('Choose files')
  fireEvent.change(input, { target: { files } })
}

describe('file intake and scan flow', () => {
  it('scans the four dummy files picked with "Choose files" and shows the verdict with counts', async () => {
    const workers: FakeWorker[] = []
    const create = () => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    }
    render(<App createWorker={create} />)
    pick([
      asFile('dummy-config.js', dummyConfig),
      asFile('dummy-customers.csv', dummyCustomers),
      asFile('dummy-support-chat.txt', dummyChat),
      asFile('dummy-README.md', dummyReadme),
    ])
    expect(await screen.findByRole('heading', { name: 'Likely blocked' })).toBeInTheDocument()
    expect(screen.getByText('4 scanned · 0 skipped')).toBeInTheDocument()
    expect(screen.getByText('5 likely to block · 13 to review')).toBeInTheDocument()
    expect(workers[0]!.terminated).toBe(true)
  })

  it('skips ignored folders and binaries from a folder pick and shows why', async () => {
    render(<App createWorker={() => new FakeWorker()} />)
    pick([
      asFile('a.md', 'Monthly sales.', 'shop/a.md'),
      asFile('index.js', 'x', 'shop/node_modules/lib/index.js'),
      asFile('other.js', 'x', 'shop/node_modules/other.js'),
      asFile('logo.png', 'x', 'shop/logo.png'),
    ])
    expect(await screen.findByRole('heading', { name: 'No issues found in scanned files' })).toBeInTheDocument()
    expect(screen.getByText('1 scanned · 2 skipped')).toBeInTheDocument()
    expect(screen.getByText(/Ignored folder .*: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Binary, PDF, image or archive: 1/)).toBeInTheDocument()
    expect(screen.getByText('shop/node_modules/')).toBeInTheDocument()
  })

  it('Cancel terminates the worker and returns to the drop zone (FR4)', async () => {
    let worker: FakeWorker | undefined
    render(<App createWorker={() => (worker = new FakeWorker(true))} />)
    pick([asFile('a.txt', 'S8412369B')])
    await waitFor(() => expect(worker?.posted).toHaveLength(1))
    expect(screen.getByRole('status')).toHaveTextContent('Scanning file 1 of 1')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(worker!.terminated).toBe(true)
    expect(screen.getByText(CANCELLED_TEXT)).toBeInTheDocument()
    expect(screen.getByLabelText('Choose files')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Likely blocked/ })).not.toBeInTheDocument()
  })

  it('a re-run replaces the first result', async () => {
    render(<App createWorker={() => new FakeWorker()} />)
    pick([asFile('a.txt', 'id S8412369B')])
    expect(await screen.findByRole('heading', { name: 'Likely blocked' })).toBeInTheDocument()
    pick([asFile('a.txt', 'clean now')])
    expect(await screen.findByRole('heading', { name: 'No issues found in scanned files' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Likely blocked' })).not.toBeInTheDocument()
  })

  it('explains the fallback where folder drop is unsupported', () => {
    // jsdom has no DataTransferItem, like a browser without the folder API.
    render(<App createWorker={() => new FakeWorker()} />)
    expect(screen.getByText(FOLDER_DROP_FALLBACK)).toBeInTheDocument()
  })
})
