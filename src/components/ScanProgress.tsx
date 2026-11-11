interface Props {
  /** null while files are still being read, before the worker starts. */
  done: number | null
  total: number
  path?: string | undefined
  onCancel: () => void
}

export function ScanProgress({ done, total, path, onCancel }: Props) {
  const label = done === null ? 'Reading files…' : `Scanning file ${Math.min(done + 1, total)} of ${total}`
  return (
    <section aria-label="Scan progress" className="rounded-lg border border-slate-200 bg-white p-6">
      <p role="status" aria-live="polite" className="text-sm font-medium text-slate-900">
        {label}
      </p>
      <progress
        className="mt-3 h-2 w-full"
        max={done === null ? undefined : Math.max(total, 1)}
        value={done === null ? undefined : done}
        aria-label="Files scanned"
      />
      {path && <p className="mt-2 truncate text-sm text-slate-600">{path}</p>}
      <button
        type="button"
        onClick={onCancel}
        className="mt-4 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
      >
        Cancel
      </button>
    </section>
  )
}
