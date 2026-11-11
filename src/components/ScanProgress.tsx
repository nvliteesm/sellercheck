import { useEffect, useRef, useState } from 'react'

interface Props {
  /** null while files are still being read, before the worker starts. */
  done: number | null
  total: number
  path?: string | undefined
  onCancel: () => void
}

/** Screen readers hear progress at most this often, not once per file. */
export const ANNOUNCE_EVERY_MS = 2000

export function ScanProgress({ done, total, path, onCancel }: Props) {
  const label = done === null ? 'Reading files…' : `Scanning file ${Math.min(done + 1, total)} of ${total}`
  const phase = done === null ? 'reading' : 'scanning'

  // Throttled copy of the label for the live region.
  const [announced, setAnnounced] = useState(label)
  const last = useRef({ at: Date.now(), phase })
  useEffect(() => {
    const now = Date.now()
    if (phase !== last.current.phase || now - last.current.at >= ANNOUNCE_EVERY_MS) {
      last.current = { at: now, phase }
      setAnnounced(label)
    }
  }, [label, phase])

  // The drop zone disappears when a scan starts; give focus to Cancel instead of losing it.
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!document.activeElement || document.activeElement === document.body) cancel.current?.focus()
  }, [])

  return (
    <section aria-label="Scan progress" className="rounded-lg border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <p role="status" aria-live="polite" className="sr-only">
        {announced}
      </p>
      <progress
        className="mt-3 h-2 w-full"
        max={done === null ? undefined : Math.max(total, 1)}
        value={done === null ? undefined : done}
        aria-label="Files scanned"
      />
      {path && <p className="mt-2 truncate text-sm text-slate-600">{path}</p>}
      <button
        ref={cancel}
        type="button"
        onClick={onCancel}
        className="mt-4 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
      >
        Cancel
      </button>
    </section>
  )
}
