import type { KnownGap } from '../rules'
import { summaryClass } from './ui'

export function KnownGaps({ gaps }: { gaps: readonly KnownGap[] }) {
  return (
    <details className="text-sm">
      <summary className={summaryClass}>What this check does not cover</summary>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        {gaps.map((g) => (
          <li key={g.label}>
            <span className="font-medium">{g.label}.</span> <span className="text-slate-700">{g.why}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
