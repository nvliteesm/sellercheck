import { useRef, useState } from 'react'
import { DropZone } from './components/DropZone'
import { ScanProgress } from './components/ScanProgress'
import { type IntakeFile, SKIP_REASON_TEXT, readIntake } from './lib/readFiles'
import { type ScanHandle, type WorkerLike, createScannerWorker, startScan } from './worker/client'
import {
  type DoneMessage,
  type Finding,
  type SkippedFile,
  SKIP_REASONS,
  VERDICT_TEXT,
  countsText,
} from './worker/protocol'

export const APP_TITLE = 'SellerCheck SG'
export const UNOFFICIAL_LABEL = 'Unofficial, not affiliated with HUD or DataVendor'
export const CANCELLED_TEXT = 'Scan cancelled. No results were kept.'

type State =
  | { kind: 'idle'; note?: string }
  | { kind: 'reading' }
  | { kind: 'scanning'; done: number; total: number; path?: string }
  | { kind: 'done'; result: DoneMessage; findings: Finding[]; skipped: SkippedFile[] }

interface Props {
  /** Injected in tests; the real app starts a module worker. */
  createWorker?: () => WorkerLike
}

export default function App({ createWorker = createScannerWorker }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const scan = useRef<ScanHandle | null>(null)
  // Bumped on every new scan and on cancel, so stale async work is ignored.
  const run = useRef(0)

  const onFiles = async (entries: IntakeFile[], preSkipped: SkippedFile[]) => {
    const id = ++run.current
    scan.current?.cancel()
    setState({ kind: 'reading' })

    const intake = await readIntake(entries, preSkipped, () => run.current !== id)
    if (run.current !== id) return

    const findings: Finding[] = []
    setState({ kind: 'scanning', done: 0, total: intake.files.length })
    scan.current = startScan(
      intake.files,
      intake.skipped,
      {
        onMessage: (m) => {
          if (run.current !== id) return
          if (m.type === 'start') setState({ kind: 'scanning', done: m.index, total: m.total, path: m.path })
          else if (m.type === 'finding') findings.push(m.finding)
          else if (m.type === 'progress') setState((s) => (s.kind === 'scanning' ? { ...s, done: m.done } : s))
          else if (m.type === 'done') {
            scan.current = null
            setState({ kind: 'done', result: m, findings, skipped: intake.skipped })
          }
        },
        onError: (error) => {
          if (run.current !== id) return
          scan.current = null
          setState({ kind: 'idle', note: `${error} Please try again.` })
        },
      },
      createWorker,
    )
  }

  const onCancel = () => {
    run.current++
    scan.current?.cancel()
    scan.current = null
    setState({ kind: 'idle', note: CANCELLED_TEXT })
  }

  const busy = state.kind === 'reading' || state.kind === 'scanning'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-xl font-semibold tracking-tight">{APP_TITLE}</h1>
          <p className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900">
            {UNOFFICIAL_LABEL}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <p className="max-w-prose text-base leading-relaxed text-slate-700">
          A free check that runs entirely in your browser and shows which files are likely to fail
          required checks for credentials and Singapore personal data. Nothing is uploaded.
        </p>

        {!busy && <DropZone onFiles={onFiles} />}

        {state.kind === 'idle' && state.note && (
          <p role="status" className="text-sm text-slate-700">
            {state.note}
          </p>
        )}

        {state.kind === 'reading' && <ScanProgress done={null} total={0} onCancel={onCancel} />}
        {state.kind === 'scanning' && (
          <ScanProgress done={state.done} total={state.total} path={state.path} onCancel={onCancel} />
        )}

        {state.kind === 'done' && <ResultSummary result={state.result} skipped={state.skipped} />}
      </main>

      <footer className="mx-auto max-w-4xl px-4 pb-10 text-sm text-slate-600">
        <p>
          Advice only. A clean result is not permission to sell data and is not legal advice.
        </p>
      </footer>
    </div>
  )
}

// Interim result view: verdict, counts and skipped files. The finding list comes in the next step.
function ResultSummary({ result, skipped }: { result: DoneMessage; skipped: SkippedFile[] }) {
  return (
    <section aria-label="Result" className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">{VERDICT_TEXT[result.verdict]}</h2>
      <p className="mt-1 text-sm text-slate-600">{countsText(result.scanned, result.skipped)}</p>
      <p className="mt-3 text-sm">
        {result.totals.blocker} likely to block · {result.totals.review} to review
      </p>
      {skipped.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer">Skipped files ({skipped.length})</summary>
          <ul className="mt-2 space-y-1">
            {SKIP_REASONS.filter((r) => result.skippedByReason[r] > 0).map((r) => (
              <li key={r}>
                {SKIP_REASON_TEXT[r]}: {result.skippedByReason[r]}
              </li>
            ))}
          </ul>
          <ul className="mt-2 max-h-48 overflow-auto font-mono text-xs text-slate-600">
            {skipped.map((s) => (
              <li key={`${s.reason}:${s.path}`}>{s.path}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
