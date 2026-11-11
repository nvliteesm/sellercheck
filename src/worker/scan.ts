// The scan loop the worker runs, kept free of worker globals so it can be unit-tested.

import { type RulePack, scanText, totalsOf } from '../rules'
import { type ScanMessage, type WorkerToPage, countSkipped, verdictFor } from './protocol'

/**
 * Scan every file in `msg`, posting start, finding, progress and done in protocol order.
 * Findings are masked by the rules before they are posted (FR7).
 */
export function runScan(msg: ScanMessage, post: (m: WorkerToPage) => void, pack: RulePack): void {
  const total = msg.files.length
  let blocker = 0
  let review = 0
  let genericEmailsSkipped = 0

  msg.files.forEach((file, index) => {
    post({ type: 'start', index, total, path: file.path })
    const result = scanText(file.path, file.text, pack)
    for (const finding of result.findings) post({ type: 'finding', finding })
    const t = totalsOf(result.findings)
    blocker += t.blocker
    review += t.review
    genericEmailsSkipped += result.skippedMatches['generic-email']
    post({ type: 'progress', done: index + 1, total, findingsInFile: result.findings.length })
  })

  const totals = { blocker, review }
  post({
    type: 'done',
    totals,
    scanned: total,
    skipped: msg.skipped.length,
    skippedByReason: countSkipped(msg.skipped),
    genericEmailsSkipped,
    verdict: verdictFor(totals),
  })
}
