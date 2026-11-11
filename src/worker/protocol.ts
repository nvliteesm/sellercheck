// Typed message protocol shared by the page and the scanner worker (PRD v2, "Worker messages").
//
// Page to worker: scan.
// Worker to page: ready, start, finding, progress, done.
// Cancel is not a message: the page terminates the worker.
//
// Every value that leaves the worker is already masked (FR7). Nothing in this file carries raw
// matched text: a Finding holds `masked`, never the original value.

export type Severity = 'blocker' | 'review'

/** Why a file was not scanned (FR2). The page decides this before posting `scan`. */
export type SkipReason =
  | 'ignored-folder' // node_modules, .git, dist, build, .next, vendor, __pycache__
  | 'binary' // binary, PDF or image
  | 'too-large' // over the 1.5 MB size cap
  | 'file-cap' // beyond the 3,000-file cap
  | 'unreadable' // the browser could not read it as text

export const SKIP_REASONS: readonly SkipReason[] = [
  'ignored-folder',
  'binary',
  'too-large',
  'file-cap',
  'unreadable',
]

export type Verdict = 'likely-blocked' | 'needs-review' | 'no-issues'

/** Wording shown to the seller for each verdict (PRD v2, "Verdict rule"). */
export const VERDICT_TEXT: Readonly<Record<Verdict, string>> = {
  'likely-blocked': 'Likely blocked',
  'needs-review': 'Needs review',
  'no-issues': 'No issues found in scanned files',
}

export interface ScanFile {
  /** Path relative to the dropped folder, or the file name. */
  readonly path: string
  readonly text: string
}

export interface SkippedFile {
  readonly path: string
  readonly reason: SkipReason
}

/** One finding, with all seven fields FR5 requires (file, line, severity, label, masked, reason, fix). */
export interface Finding {
  readonly path: string
  /** 1-based line number. */
  readonly line: number
  /** 1-based column of the matched value. */
  readonly column: number
  readonly ruleId: string
  readonly severity: Severity
  readonly label: string
  /** The matched value with its sensitive part masked. Never the raw value. */
  readonly masked: string
  readonly reason: string
  readonly fix: string
}

export interface SeverityTotals {
  readonly blocker: number
  readonly review: number
}

// ---------- Page to worker ----------

export interface ScanMessage {
  readonly type: 'scan'
  readonly files: readonly ScanFile[]
  /** Files the page did not send, with the reason, so the count and list can be shown. */
  readonly skipped: readonly SkippedFile[]
}

export type PageToWorker = ScanMessage

// ---------- Worker to page ----------

/** The worker has loaded and is ready for `scan`. */
export interface ReadyMessage {
  readonly type: 'ready'
}

/** The worker is starting a file. */
export interface StartMessage {
  readonly type: 'start'
  /** 0-based index of the file in `scan.files`. */
  readonly index: number
  readonly total: number
  readonly path: string
}

export interface FindingMessage {
  readonly type: 'finding'
  readonly finding: Finding
}

/** A file has finished. */
export interface ProgressMessage {
  readonly type: 'progress'
  /** Files finished so far, including this one. */
  readonly done: number
  readonly total: number
  readonly findingsInFile: number
}

export interface DoneMessage {
  readonly type: 'done'
  readonly totals: SeverityTotals
  readonly scanned: number
  readonly skipped: number
  readonly skippedByReason: Readonly<Record<SkipReason, number>>
  /** Role addresses such as info@ and support@ that matched the email pattern but were not flagged. */
  readonly genericEmailsSkipped: number
  readonly verdict: Verdict
}

export type WorkerToPage =
  | ReadyMessage
  | StartMessage
  | FindingMessage
  | ProgressMessage
  | DoneMessage

// ---------- Helpers ----------

/** Verdict rule: any blocker gives Likely blocked; else any review item gives Needs review; else no issues. */
export function verdictFor(totals: SeverityTotals): Verdict {
  if (totals.blocker > 0) return 'likely-blocked'
  if (totals.review > 0) return 'needs-review'
  return 'no-issues'
}

/** "N scanned · M skipped", shown beside every verdict (FR6). */
export function countsText(scanned: number, skipped: number): string {
  return `${scanned} scanned · ${skipped} skipped`
}

export function countSkipped(skipped: readonly SkippedFile[]): Record<SkipReason, number> {
  const counts = Object.fromEntries(SKIP_REASONS.map((r) => [r, 0])) as Record<SkipReason, number>
  for (const s of skipped) counts[s.reason] += 1
  return counts
}

// ---------- Runtime guards ----------
// postMessage data is untyped at runtime, so each side checks what it receives.

type Rec = Record<string, unknown>

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isSeverity = (v: unknown): v is Severity => v === 'blocker' || v === 'review'
const isSkipReason = (v: unknown): v is SkipReason => SKIP_REASONS.includes(v as SkipReason)
const isVerdict = (v: unknown): v is Verdict => isStr(v) && Object.hasOwn(VERDICT_TEXT, v)

function isFinding(v: unknown): v is Finding {
  return (
    isRec(v) &&
    isStr(v.path) &&
    isCount(v.line) &&
    v.line >= 1 &&
    isCount(v.column) &&
    v.column >= 1 &&
    isStr(v.ruleId) &&
    isSeverity(v.severity) &&
    isStr(v.label) &&
    isStr(v.masked) &&
    isStr(v.reason) &&
    isStr(v.fix)
  )
}

export function isPageToWorker(v: unknown): v is PageToWorker {
  return (
    isRec(v) &&
    v.type === 'scan' &&
    Array.isArray(v.files) &&
    v.files.every((f) => isRec(f) && isStr(f.path) && isStr(f.text)) &&
    Array.isArray(v.skipped) &&
    v.skipped.every((s) => isRec(s) && isStr(s.path) && isSkipReason(s.reason))
  )
}

export function isWorkerToPage(v: unknown): v is WorkerToPage {
  if (!isRec(v)) return false
  switch (v.type) {
    case 'ready':
      return true
    case 'start':
      return isCount(v.index) && isCount(v.total) && isStr(v.path)
    case 'finding':
      return isFinding(v.finding)
    case 'progress':
      return isCount(v.done) && isCount(v.total) && isCount(v.findingsInFile)
    case 'done':
      return (
        isRec(v.totals) &&
        isCount(v.totals.blocker) &&
        isCount(v.totals.review) &&
        isCount(v.scanned) &&
        isCount(v.skipped) &&
        isRec(v.skippedByReason) &&
        SKIP_REASONS.every((r) => isCount((v.skippedByReason as Rec)[r])) &&
        isCount(v.genericEmailsSkipped) &&
        isVerdict(v.verdict)
      )
    default:
      return false
  }
}
