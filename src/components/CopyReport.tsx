import { useState } from 'react'

const button =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700'

/** Copies the plain-text report. Where the clipboard is unavailable, shows it to select by hand. */
export function CopyReport({ text }: { text: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('copied')
    } catch {
      setStatus('manual')
    }
  }

  return (
    <div>
      <button type="button" onClick={copy} className={button}>
        Copy report
      </button>
      <span role="status" className="ml-3 text-sm text-slate-700">
        {status === 'copied' && 'Report copied.'}
        {status === 'manual' && 'Copying is blocked here. Select the text below and copy it.'}
      </span>
      {status === 'manual' && (
        <textarea
          readOnly
          aria-label="Report text"
          value={text}
          className="mt-3 h-64 w-full rounded-md border border-slate-300 p-2 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </div>
  )
}
