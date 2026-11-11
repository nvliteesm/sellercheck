// Module worker entry. Receives `scan`, posts masked results. Cancel = the page terminates it.

import { sgPack } from '../rules'
import { type WorkerToPage, isPageToWorker } from './protocol'
import { runScan } from './scan'

// The project's tsconfig uses the DOM lib, so describe only the worker scope members we use.
interface WorkerScope {
  onmessage: ((e: MessageEvent<unknown>) => void) | null
  postMessage(message: WorkerToPage): void
}

const scope = self as unknown as WorkerScope
const post = (m: WorkerToPage) => scope.postMessage(m)

scope.onmessage = (e) => {
  // Ignore anything that is not a well-formed scan message.
  if (!isPageToWorker(e.data)) return
  runScan(e.data, post, sgPack)
}

post({ type: 'ready' })
