import { useEffect, useRef } from 'react'
import { SKIP_REASON_TEXT } from '../lib/readFiles'
import { type DoneMessage, type SkippedFile, SKIP_REASONS, VERDICT_TEXT, countsText } from '../worker/protocol'

const TONE = {
  'likely-blocked': 'border-red-300 bg-red-50 text-red-900',
  'needs-review': 'border-amber-300 bg-amber-50 text-amber-900',
  'no-issues': 'border-emerald-300 bg-emerald-50 text-emerald-900',
} as const

interface Props {
  result: DoneMessage
  skipped: readonly SkippedFile[]
}

export function Verdict({ result, skipped }: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  // Move focus to the result so keyboard and screen reader users land on it when the scan ends.
  useEffect(() => heading.current?.focus(), [result])

  return (
    <section aria-labelledby="verdict-heading" className={`rounded-lg border p-6 ${TONE[result.verdict]}`}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="verdict-heading" ref={heading} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
          {VERDICT_TEXT[result.verdict]}
        </h2>
        <p className="text-sm font-medium">{countsText(result.scanned, result.skipped)}</p>
      </div>
      <p className="mt-2 text-sm">
        {result.totals.blocker} likely to block · {result.totals.review} to review
        {result.genericEmailsSkipped > 0 &&
          ` · ${result.genericEmailsSkipped} role email address${result.genericEmailsSkipped === 1 ? '' : 'es'} (such as support@) not flagged`}
      </p>

      {skipped.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium">Skipped files ({skipped.length})</summary>
          <ul className="mt-2 space-y-1">
            {SKIP_REASONS.filter((r) => result.skippedByReason[r] > 0).map((r) => (
              <li key={r}>
                {SKIP_REASON_TEXT[r]}: {result.skippedByReason[r]}
              </li>
            ))}
          </ul>
          <ul className="mt-2 max-h-48 overflow-auto font-mono text-xs">
            {skipped.map((s) => (
              <li key={`${s.reason}:${s.path}`}>{s.path}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
