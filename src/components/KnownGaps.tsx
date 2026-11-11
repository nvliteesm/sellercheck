import type { KnownGap } from '../rules'

export function KnownGaps({ gaps }: { gaps: readonly KnownGap[] }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-medium">What this check does not cover</summary>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        {gaps.map((g) => (
          <li key={g.label}>
            <span className="font-medium">{g.label}.</span> <span className="text-slate-700">{g.why}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
