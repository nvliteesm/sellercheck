import { type ReactNode, useEffect, useRef } from 'react'
import { SKIP_REASON_TEXT } from '../lib/readFiles'
import { type DoneMessage, type SkippedFile, SKIP_REASONS, VERDICT_TEXT, countsText } from '../worker/protocol'
import { summaryClass } from './ui'

const TONE = {
  'likely-blocked': 'border-red-300 bg-red-50 text-red-900',
  'needs-review': 'border-amber-300 bg-amber-50 text-amber-900',
  'no-issues': 'border-emerald-300 bg-emerald-50 text-emerald-900',
} as const

interface Props {
  result: DoneMessage
  skipped: readonly SkippedFile[]
  /** Actions shown at the bottom of the card, such as Copy report. */
  children?: ReactNode
}

export function Verdict({ result, skipped, children }: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  // Move focus to the result so keyboard and screen reader users land on it when the scan ends.
  useEffect(() => heading.current?.focus(), [result])
  const { blocker, review } = result.totals
  const roleEmails = result.genericEmailsSkipped
  const hasDetails = skipped.length > 0 || roleEmails > 0

  return (
    <section aria-labelledby="verdict-heading" className={`rounded-xl border p-6 ${TONE[result.verdict]}`}>
      <h2 id="verdict-heading" ref={heading} tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
        {VERDICT_TEXT[result.verdict]}
      </h2>
      <p className="mt-1 text-sm font-medium">{countsText(result.scanned, result.skipped)}</p>
      {(blocker > 0 || review > 0) && (
        <p className="mt-3 text-base">
          {blocker} likely to block · {review} to review
        </p>
      )}

      {hasDetails && (
        <details className="mt-3 text-sm">
          <summary className={summaryClass}>Details</summary>
          {roleEmails > 0 && (
            <p className="mt-2">
              {roleEmails} role email address{roleEmails === 1 ? '' : 'es'} (such as support@) not flagged.
            </p>
          )}
          {skipped.length > 0 && (
            <>
              <p className="mt-2 font-medium">Skipped files</p>
              <ul className="mt-1 space-y-1">
                {SKIP_REASONS.filter((r) => result.skippedByReason[r] > 0).map((r) => (
                  <li key={r}>
                    {SKIP_REASON_TEXT[r]}: {result.skippedByReason[r]}
                  </li>
                ))}
              </ul>
              <ul aria-label="Skipped files" className="mt-2 max-h-48 overflow-auto font-mono text-xs">
                {skipped.map((s) => (
                  <li key={`${s.reason}:${s.path}`}>{s.path}</li>
                ))}
              </ul>
            </>
          )}
        </details>
      )}

      {children && <div className="mt-4">{children}</div>}
    </section>
  )
}
