import { useState } from 'react'
import { secondaryButton as button } from './ui'


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
      <span role="status" className="ml-3 text-sm">
        {status === 'copied' && 'Report copied.'}
        {status === 'manual' && 'Copy blocked. Select the text below instead.'}
      </span>
      {status === 'manual' && (
        <textarea
          readOnly
          aria-label="Report text"
          value={text}
          className="mt-3 h-64 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs text-slate-900"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </div>
  )
}
