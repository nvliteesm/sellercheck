// Page-side handle for one scan: starts a worker, sends `scan` once the worker is ready,
// validates every message it gets back, and cancels by terminating the worker (FR4).

import {
  type PageToWorker,
  type ScanFile,
  type SkippedFile,
  type WorkerToPage,
  isWorkerToPage,
} from './protocol'

/** The parts of Worker the client uses, so tests can pass a fake. */
export interface WorkerLike {
  onmessage: ((e: MessageEvent<unknown>) => void) | null
  onerror: ((e: ErrorEvent) => void) | null
  postMessage(message: PageToWorker): void
  terminate(): void
}

export interface ScanHandlers {
  /** Every valid message after `ready`: start, finding, progress, done. */
  onMessage: (message: WorkerToPage) => void
  /** The worker failed or sent a malformed message. The scan has stopped. */
  onError?: (error: string) => void
}

export interface ScanHandle {
  /** Stop the scan now. No further messages are delivered. */
  cancel: () => void
}

export function createScannerWorker(): WorkerLike {
  return new Worker(new URL('./scanner.worker.ts', import.meta.url), { type: 'module' })
}

export function startScan(
  files: readonly ScanFile[],
  skipped: readonly SkippedFile[],
  handlers: ScanHandlers,
  createWorker: () => WorkerLike = createScannerWorker,
): ScanHandle {
  const worker = createWorker()
  let stopped = false

  const stop = () => {
    if (stopped) return
    stopped = true
    worker.onmessage = null
    worker.onerror = null
    worker.terminate()
  }

  const fail = (error: string) => {
    stop()
    handlers.onError?.(error)
  }

  worker.onmessage = (e) => {
    if (stopped) return
    const message = e.data
    if (!isWorkerToPage(message)) {
      fail('The scanner sent an unexpected message.')
      return
    }
    if (message.type === 'ready') {
      worker.postMessage({ type: 'scan', files, skipped })
      return
    }
    handlers.onMessage(message)
    // One worker per scan: a re-run (FR10) starts a fresh one.
    if (message.type === 'done') stop()
  }

  worker.onerror = () => fail('The scanner stopped unexpectedly.')

  return { cancel: stop }
}
