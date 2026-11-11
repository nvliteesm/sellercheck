import { SEVERITY_TEXT, groupByFile } from '../lib/report'
import type { Finding } from '../worker/protocol'

const BADGE = {
  blocker: 'bg-red-100 text-red-900 ring-red-300',
  review: 'bg-amber-100 text-amber-900 ring-amber-300',
} as const

export function FindingList({ findings }: { findings: readonly Finding[] }) {
  if (findings.length === 0) return null
  const groups = groupByFile(findings)
  return (
    <section aria-labelledby="findings-heading" className="space-y-4">
      <h2 id="findings-heading" className="text-lg font-semibold">
        Findings by file
      </h2>
      {groups.map((g) => (
        <article key={g.path} aria-label={g.path} className="rounded-lg border border-slate-200 bg-white">
          <h3 className="break-all border-b border-slate-200 px-4 py-3 font-mono text-sm font-semibold">
            {g.path}
            <span className="ml-2 font-sans text-xs font-normal text-slate-600">
              {g.findings.length} finding{g.findings.length === 1 ? '' : 's'}
            </span>
          </h3>
          <ul className="divide-y divide-slate-100">
            {g.findings.map((f) => (
              <li key={`${f.line}:${f.column}:${f.ruleId}`} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-600">Line {f.line}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ring-1 ${BADGE[f.severity]}`}>
                    {SEVERITY_TEXT[f.severity]}
                  </span>
                  <span className="font-medium">{f.label}</span>
                  <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 text-xs">{f.masked}</code>
                </div>
                <p className="mt-1 text-slate-700">{f.reason}</p>
                <p className="mt-1 text-slate-900">
                  <span className="font-medium">Fix: </span>
                  {f.fix}
                </p>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  )
}
