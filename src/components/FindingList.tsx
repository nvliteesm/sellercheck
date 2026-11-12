import { type KeyboardEvent, useId, useRef, useState } from 'react'
import { type RuleGroup, SEVERITY_TEXT, groupByFile, groupByRule } from '../lib/report'
import type { Finding, Severity } from '../worker/protocol'
import { focusRing, summaryClass } from './ui'

/** Rows shown per category before "Show all". */
export const SHOWN_ROWS = 3

const TABS: readonly Severity[] = ['blocker', 'review']

const TAB_TONE = {
  blocker: { active: 'border-red-700 text-red-900', count: 'bg-red-100 text-red-900' },
  review: { active: 'border-amber-600 text-amber-900', count: 'bg-amber-100 text-amber-900' },
} as const

const EMPTY_TEXT = { blocker: 'Nothing likely to block.', review: 'Nothing to review.' } as const

function RuleGroupRows({ group }: { group: RuleGroup }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const rows = expanded ? group.findings : group.findings.slice(0, SHOWN_ROWS)
  const hidden = group.findings.length - SHOWN_ROWS

  return (
    <li className="space-y-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-base font-medium">{group.label}</span>
        {group.findings.length > 1 && <span className="text-slate-700">×{group.findings.length}</span>}
      </div>
      <ul id={listId} aria-label={`${group.label} found`} className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {rows.map((f) => (
          <li key={`${f.line}:${f.column}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
            <span className="w-16 shrink-0 text-xs font-medium text-slate-700">Line {f.line}</span>
            <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 text-xs">{f.masked}</code>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
          className={`rounded text-sm font-medium text-sky-800 underline-offset-2 hover:underline ${focusRing}`}
        >
          {expanded ? 'Show fewer' : `Show all ${group.findings.length}`}
        </button>
      )}
      <p className="text-slate-900">
        <span className="font-medium">Fix: </span>
        {group.fix}
      </p>
      <details>
        <summary className={`${summaryClass} text-xs`}>Why?</summary>
        <p className="mt-1 text-slate-700">{group.reason}</p>
      </details>
    </li>
  )
}

function FileGroups({ findings, severity }: { findings: readonly Finding[]; severity: Severity }) {
  if (findings.length === 0) return <p className="px-1 py-4 text-sm text-slate-700">{EMPTY_TEXT[severity]}</p>
  return (
    <div className="space-y-3">
      {groupByFile(findings).map((file) => (
        <article key={file.path} aria-label={file.path} className="rounded-lg border border-slate-200 bg-white">
          <h3 className="break-all border-b border-slate-200 px-4 py-3 font-mono text-sm font-semibold">{file.path}</h3>
          <ul className="divide-y divide-slate-100">
            {groupByRule(file.findings).map((g) => (
              <RuleGroupRows key={`${g.ruleId}:${g.findings[0]!.line}`} group={g} />
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}

/** Findings split into two tabs by severity, "Likely to block" first (WAI-ARIA tabs pattern). */
export function FindingList({ findings }: { findings: readonly Finding[] }) {
  const bySeverity = {
    blocker: findings.filter((f) => f.severity === 'blocker'),
    review: findings.filter((f) => f.severity === 'review'),
  }
  // "Likely to block" opens first; only when it is empty does Review open instead.
  const [active, setActive] = useState<Severity>(bySeverity.blocker.length > 0 ? 'blocker' : 'review')
  const tabRefs = useRef<Partial<Record<Severity, HTMLButtonElement | null>>>({})

  if (findings.length === 0) return null

  const select = (s: Severity) => {
    setActive(s)
    tabRefs.current[s]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.indexOf(active)
    const next =
      e.key === 'ArrowRight' ? TABS[(i + 1) % TABS.length]
      : e.key === 'ArrowLeft' ? TABS[(i - 1 + TABS.length) % TABS.length]
      : e.key === 'Home' ? TABS[0]
      : e.key === 'End' ? TABS[TABS.length - 1]
      : undefined
    if (next) {
      e.preventDefault()
      select(next)
    }
  }

  return (
    <section aria-labelledby="findings-heading" className="space-y-3">
      <h2 id="findings-heading" className="text-lg font-semibold">
        What to fix
      </h2>
      <div role="tablist" aria-labelledby="findings-heading" className="flex gap-1 border-b border-slate-200">
        {TABS.map((s) => {
          const selected = s === active
          return (
            <button
              key={s}
              ref={(el) => {
                tabRefs.current[s] = el
              }}
              id={`tab-${s}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${s}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(s)}
              onKeyDown={onKeyDown}
              className={`-mb-px inline-flex items-center gap-2 rounded-t-md border-b-2 px-4 py-2.5 text-sm font-medium ${focusRing} ${
                selected ? `${TAB_TONE[s].active} bg-white` : 'border-transparent text-slate-700 hover:text-slate-900'
              }`}
            >
              {SEVERITY_TEXT[s]}{' '}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TAB_TONE[s].count}`}>
                {bySeverity[s].length}
              </span>
            </button>
          )
        })}
      </div>
      {TABS.map((s) => (
        <div
          key={s}
          id={`panel-${s}`}
          role="tabpanel"
          aria-labelledby={`tab-${s}`}
          hidden={s !== active}
          tabIndex={0}
          className={`rounded ${focusRing}`}
        >
          {s === active && <FileGroups findings={bySeverity[s]} severity={s} />}
        </div>
      ))}
    </section>
  )
}
