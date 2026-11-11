import { useRef, useState } from 'react'
import { CopyReport } from './components/CopyReport'
import { DropZone } from './components/DropZone'
import { FindingList } from './components/FindingList'
import { KnownGaps } from './components/KnownGaps'
import { NetworkProof } from './components/NetworkProof'
import { ScanProgress } from './components/ScanProgress'
import { Verdict } from './components/Verdict'
import { type IntakeFile, readIntake } from './lib/readFiles'
import { NOTICE_TEXT, buildReport } from './lib/report'
import { sgPack } from './rules'
import { type ScanHandle, type WorkerLike, createScannerWorker, startScan } from './worker/client'
import type { DoneMessage, Finding, SkippedFile } from './worker/protocol'

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
  // Shown on every state (FR9); directly under the verdict when there is a result.
  const notice = (
    <p role="note" className="rounded-lg border border-slate-300 bg-slate-100 p-4 text-sm text-slate-800">
      {NOTICE_TEXT}
    </p>
  )

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

        {state.kind === 'done' && (
          <>
            <Verdict result={state.result} skipped={state.skipped} />
            {notice}
            <CopyReport text={buildReport(state.result, state.findings, state.skipped, sgPack.knownGaps)} />
            <FindingList findings={state.findings} />
          </>
        )}

        {state.kind !== 'done' && notice}
        <KnownGaps gaps={sgPack.knownGaps} />
        <NetworkProof />
      </main>

      <footer className="mx-auto max-w-4xl px-4 pb-10 text-sm text-slate-600">
        <p>Unofficial concept built only from public pages and docs. Not a HUD or DataVendor product.</p>
      </footer>
    </div>
  )
}
