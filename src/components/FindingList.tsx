import { SEVERITY_TEXT, groupByFile, groupByRule } from '../lib/report'
import type { Finding } from '../worker/protocol'
import { summaryClass } from './ui'

const BADGE = {
  blocker: 'bg-red-100 text-red-900 ring-red-300',
  review: 'bg-amber-100 text-amber-900 ring-amber-300',
} as const

/** Long lists (a CSV with hundreds of rows) show the first few examples only. */
export const MAX_EXAMPLES = 5

function linesText(findings: readonly Finding[]): string {
  const lines = [...new Set(findings.map((f) => f.line))]
  const shown = lines.slice(0, MAX_EXAMPLES).join(', ')
  const more = lines.length > MAX_EXAMPLES ? ` and ${lines.length - MAX_EXAMPLES} more` : ''
  return `${lines.length === 1 ? 'Line' : 'Lines'} ${shown}${more}`
}

export function FindingList({ findings }: { findings: readonly Finding[] }) {
  if (findings.length === 0) return null
  return (
    <section aria-labelledby="findings-heading" className="space-y-3">
      <h2 id="findings-heading" className="text-lg font-semibold">
        What to fix
      </h2>
      {groupByFile(findings).map((file) => (
        <article key={file.path} aria-label={file.path} className="rounded-lg border border-slate-200 bg-white">
          <h3 className="break-all border-b border-slate-200 px-4 py-3 font-mono text-sm font-semibold">{file.path}</h3>
          <ul className="divide-y divide-slate-100">
            {groupByRule(file.findings).map((g) => (
              <li key={`${g.ruleId}:${g.findings[0]!.line}`} className="space-y-1.5 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ring-1 ${BADGE[g.severity]}`}>
                    {SEVERITY_TEXT[g.severity]}
                  </span>
                  <span className="font-medium">{g.label}</span>
                  {g.findings.length > 1 && <span className="text-slate-600">×{g.findings.length}</span>}
                  <span className="text-xs text-slate-600">{linesText(g.findings)}</span>
                </div>
                <p className="flex flex-wrap gap-1.5">
                  {g.findings.slice(0, MAX_EXAMPLES).map((f) => (
                    <code key={`${f.line}:${f.column}`} className="break-all rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {f.masked}
                    </code>
                  ))}
                </p>
                <p className="text-slate-900">
                  <span className="font-medium">Fix: </span>
                  {g.fix}
                </p>
                <details>
                  <summary className={`${summaryClass} text-xs`}>Why?</summary>
                  <p className="mt-1 text-slate-700">{g.reason}</p>
                </details>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  )
}
