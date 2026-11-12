import { useEffect, useRef, useState } from 'react'
import { CopyReport } from './components/CopyReport'
import { DropZone, type FileSource } from './components/DropZone'
import { FindingList } from './components/FindingList'
import { KnownGaps } from './components/KnownGaps'
import { NetworkProof } from './components/NetworkProof'
import { ScanProgress } from './components/ScanProgress'
import { Verdict } from './components/Verdict'
import { readIntake } from './lib/readFiles'
import { NOTICE_TEXT, buildReport } from './lib/report'
import { sgPack } from './rules'
import { type ScanHandle, type WorkerLike, createScannerWorker, startScan } from './worker/client'
import type { DoneMessage, Finding, SkippedFile } from './worker/protocol'

export const APP_TITLE = 'SellerCheck SG'
export const UNOFFICIAL_LABEL = 'Unofficial tool'
export const CANCELLED_TEXT = 'Scan cancelled.'

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

  const noteRef = useRef<HTMLParagraphElement>(null)
  const idleNote = state.kind === 'idle' ? state.note : undefined
  // After Cancel or an error, put focus on the message so keyboard users are not left on nothing.
  useEffect(() => {
    if (idleNote) noteRef.current?.focus()
  }, [idleNote])

  const onFiles = async (source: Promise<FileSource>) => {
    const id = ++run.current
    scan.current?.cancel()
    setState({ kind: 'reading' })

    let listed: FileSource
    try {
      listed = await source
    } catch {
      if (run.current === id) setState({ kind: 'idle', note: 'Could not read the files. Please try again.' })
      return
    }
    if (run.current !== id) return
    const intake = await readIntake(listed.entries, listed.skipped, () => run.current !== id)
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
  const done = state.kind === 'done'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-xl font-semibold tracking-tight">{APP_TITLE}</h1>
          <p className="rounded-full border border-slate-300 px-3 py-0.5 text-xs font-medium text-slate-700">
            {UNOFFICIAL_LABEL}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:py-12">
        {!done && (
          <div className="space-y-2">
            <p className="text-2xl font-semibold tracking-tight sm:text-3xl">Check your files before you sell data</p>
            <p className="text-base text-slate-700">
              Finds passwords, keys and Singapore personal data. Nothing leaves your device.
            </p>
          </div>
        )}

        {state.kind === 'done' && (
          <>
            <Verdict result={state.result} skipped={state.skipped}>
              <CopyReport text={buildReport(state.result, state.findings, state.skipped, sgPack.knownGaps)} />
            </Verdict>
            <FindingList findings={state.findings} />
          </>
        )}

        {!busy && <DropZone compact={done} onFiles={onFiles} />}

        {state.kind === 'idle' && state.note && (
          <p ref={noteRef} tabIndex={-1} role="status" className="text-sm text-slate-700 focus:outline-none">
            {state.note}
          </p>
        )}

        {state.kind === 'reading' && <ScanProgress done={null} total={0} onCancel={onCancel} />}
        {state.kind === 'scanning' && (
          <ScanProgress done={state.done} total={state.total} path={state.path} onCancel={onCancel} />
        )}

        {/* Always on the page (FR9): the limits of a result, with the details one click away. */}
        <footer className="space-y-3 border-t border-slate-200 pt-5">
          <p role="note" className="text-sm text-slate-700">
            {NOTICE_TEXT}
          </p>
          <KnownGaps gaps={sgPack.knownGaps} />
          <NetworkProof />
        </footer>
      </main>
    </div>
  )
}
