// Rule engine. Rules are typed data (see sg.ts); this file only applies them, so a new rule or
// country pack changes data, not the engine (FR14).

import type { Finding, Severity, SeverityTotals } from '../worker/protocol'

/** A match that fits a pattern but is deliberately not flagged. */
export type MatchSkip = 'placeholder' | 'generic-email'

export interface Rule {
  readonly id: string
  readonly label: string
  readonly severity: Severity
  /**
   * Must have the `g` flag. When it has a named group `value`, that group is the value that is
   * masked and reported, and the pattern must also have the `d` flag so its column is known.
   * Otherwise the whole match is the value.
   */
  readonly pattern: RegExp
  /** Extra check on the value, such as the NRIC checksum. A false result drops the match silently. */
  readonly validate?: (value: string) => boolean
  /** Returns why a match should not be flagged, or undefined to flag it. Skips are counted. */
  readonly skip?: (value: string) => MatchSkip | undefined
  /** Masks the value. Runs in the worker, so the raw value never reaches the page. */
  readonly mask: (value: string) => string
  readonly reason: string
  readonly fix: string
}

/** A pattern the pack does not cover, listed on the page and in the report. */
export interface KnownGap {
  readonly label: string
  readonly why: string
}

export interface RulePack {
  readonly id: string
  readonly name: string
  /** Applied in order. Where two matches overlap on a line, the earlier rule wins. */
  readonly rules: readonly Rule[]
  readonly knownGaps: readonly KnownGap[]
}

/** A single line is read to 4,000 characters (PRD v2, Limits). */
export const MAX_LINE_LENGTH = 4000

export interface FileScanResult {
  readonly findings: Finding[]
  readonly skippedMatches: Record<MatchSkip, number>
  /** Lines longer than MAX_LINE_LENGTH; only their first MAX_LINE_LENGTH characters were scanned. */
  readonly truncatedLines: number
}

const overlaps = (spans: readonly [number, number][], a: number, b: number) =>
  spans.some(([s, e]) => a < e && s < b)

export function scanText(path: string, text: string, pack: RulePack): FileScanResult {
  const findings: Finding[] = []
  const skippedMatches: Record<MatchSkip, number> = { placeholder: 0, 'generic-email': 0 }
  let truncatedLines = 0

  const lines = text.split(/\r\n|\r|\n/)
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!
    if (line.length > MAX_LINE_LENGTH) {
      line = line.slice(0, MAX_LINE_LENGTH)
      truncatedLines += 1
    }
    const taken: [number, number][] = []

    for (const rule of pack.rules) {
      // matchAll clones the regex, so no lastIndex state leaks between lines or files.
      for (const m of line.matchAll(rule.pattern)) {
        const spanStart = m.index
        const spanEnd = m.index + m[0].length
        if (m[0].length === 0 || overlaps(taken, spanStart, spanEnd)) continue

        const value = m.groups?.['value'] ?? m[0]
        if (rule.validate && !rule.validate(value)) continue
        const skip = rule.skip?.(value)
        if (skip) {
          skippedMatches[skip] += 1
          continue
        }

        taken.push([spanStart, spanEnd])
        const valueStart = m.indices?.groups?.['value']?.[0] ?? m.index
        findings.push({
          path,
          line: i + 1,
          column: valueStart + 1,
          ruleId: rule.id,
          severity: rule.severity,
          label: rule.label,
          masked: rule.mask(value),
          reason: rule.reason,
          fix: rule.fix,
        })
      }
    }
  }

  findings.sort((a, b) => a.line - b.line || a.column - b.column)
  return { findings, skippedMatches, truncatedLines }
}

export function totalsOf(findings: readonly Finding[]): SeverityTotals {
  let blocker = 0
  let review = 0
  for (const f of findings) {
    if (f.severity === 'blocker') blocker += 1
    else review += 1
  }
  return { blocker, review }
}

export { sgPack } from './sg'
