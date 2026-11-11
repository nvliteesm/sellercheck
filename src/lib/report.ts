// Plain-text report for "Copy report" (FR8). Values are already masked by the worker.

import type { KnownGap } from '../rules'
import {
  type DoneMessage,
  type Finding,
  type SkippedFile,
  SKIP_REASONS,
  VERDICT_TEXT,
  countsText,
} from '../worker/protocol'
import { SKIP_REASON_TEXT } from './readFiles'

export const NOTICE_TEXT =
  'Advice only. A clean result is not permission to sell data and is not legal advice. ' +
  'It covers only the files that were scanned and the patterns listed under "What this check does not cover".'

export const SEVERITY_TEXT = { blocker: 'Likely to block', review: 'Review' } as const

export interface FileGroup {
  readonly path: string
  readonly findings: readonly Finding[]
  readonly blockers: number
}

/** Findings grouped by file: files with blockers first, then by path; findings by line. */
export function groupByFile(findings: readonly Finding[]): FileGroup[] {
  const byPath = new Map<string, Finding[]>()
  for (const f of findings) {
    const list = byPath.get(f.path)
    if (list) list.push(f)
    else byPath.set(f.path, [f])
  }
  return [...byPath.entries()]
    .map(([path, list]) => ({
      path,
      findings: [...list].sort((a, b) => a.line - b.line || a.column - b.column),
      blockers: list.filter((f) => f.severity === 'blocker').length,
    }))
    .sort((a, b) => Number(b.blockers > 0) - Number(a.blockers > 0) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

export function buildReport(
  result: DoneMessage,
  findings: readonly Finding[],
  skipped: readonly SkippedFile[],
  knownGaps: readonly KnownGap[],
): string {
  const out: string[] = []
  out.push('SellerCheck SG pre-flight report (unofficial, not affiliated with HUD or DataVendor)')
  out.push('')
  out.push(`Verdict: ${VERDICT_TEXT[result.verdict]} (${countsText(result.scanned, result.skipped)})`)
  out.push(`${result.totals.blocker} likely to block, ${result.totals.review} to review`)
  if (result.genericEmailsSkipped > 0) {
    out.push(`${result.genericEmailsSkipped} role email address(es) such as support@ were not flagged`)
  }

  for (const group of groupByFile(findings)) {
    out.push('', `== ${group.path} ==`)
    for (const f of group.findings) {
      out.push(`Line ${f.line}: [${SEVERITY_TEXT[f.severity]}] ${f.label}: ${f.masked}`)
      out.push(`  Why: ${f.reason}`)
      out.push(`  Fix: ${f.fix}`)
    }
  }

  if (skipped.length > 0) {
    out.push('', 'Skipped files:')
    for (const r of SKIP_REASONS) {
      if (result.skippedByReason[r] > 0) out.push(`  ${SKIP_REASON_TEXT[r]}: ${result.skippedByReason[r]}`)
    }
    for (const s of skipped) out.push(`  - ${s.path}`)
  }

  out.push('', 'What this check does not cover:')
  for (const g of knownGaps) out.push(`  - ${g.label}`)
  out.push('', NOTICE_TEXT)
  return out.join('\n')
}
