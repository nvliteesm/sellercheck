import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from 'react'
import {
  type IntakeFile,
  fromDataTransfer,
  fromFileListAsync,
  supportsFolderDrop,
  supportsFolderPicker,
} from '../lib/readFiles'
import type { SkippedFile } from '../worker/protocol'
import { secondaryButton } from './ui'

export const FOLDER_DROP_FALLBACK = 'Dropped folders do not work in this browser. Use "Choose folder".'
export const FOLDER_PICKER_FALLBACK = 'Folders do not work in this browser. Use "Choose files".'

export interface FileSource {
  entries: IntakeFile[]
  skipped: SkippedFile[]
}

interface Props {
  disabled?: boolean
  /** One slim row, used under a result to check other files. */
  compact?: boolean
  /** Called at once with a pending list, so the page can show "Reading files…" while it loads. */
  onFiles: (source: Promise<FileSource>) => void
  /** Scan the bundled made-up files. The button is hidden when this is not given. */
  onSample?: () => void
}

// focus-within, because the focused element is the hidden input inside the label.
const buttonClass =
  'inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-100 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sky-700'
const primaryClass =
  'inline-flex cursor-pointer items-center rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-800 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sky-700'

export function DropZone({ disabled = false, compact = false, onFiles, onSample }: Props) {
  const folderInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const canPickFolder = supportsFolderPicker()
  const canDropFolder = supportsFolderDrop()

  // React has no typed prop for the folder attribute, so set it directly.
  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '')
  }, [])

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const list = input.files ? Array.from(input.files) : []
    input.value = '' // allow choosing the same files again (re-run)
    if (list.length > 0) onFiles(fromFileListAsync(list).then((entries) => ({ entries, skipped: [] })))
  }

  const onDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const hasFiles = Array.from(e.dataTransfer.items ?? []).some((i) => i.kind === 'file') || e.dataTransfer.files.length > 0
    // fromDataTransfer takes the dropped entries synchronously, before the event ends.
    if (hasFiles) onFiles(fromDataTransfer(e.dataTransfer))
  }

  return (
    <section
      aria-label="Add files to check"
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`rounded-xl border-2 border-dashed text-center ${compact ? 'px-4 py-3' : 'px-6 py-10'} ${
        dragging ? 'border-sky-600 bg-sky-50' : 'border-slate-300 bg-white'
      }`}
    >
      {!compact && (
        <>
          <p className="text-lg font-medium text-slate-900">Drop files or a folder here</p>
          <p className="mt-1 text-sm text-slate-600">Text files only. No files to hand? Try a sample of made-up data.</p>
        </>
      )}

      <div className={`flex flex-wrap items-center justify-center gap-3 ${compact ? '' : 'mt-5'}`}>
        {compact && <span className="text-sm text-slate-700">Check other files:</span>}
        <label className={compact ? buttonClass : primaryClass}>
          <input type="file" multiple className="sr-only" disabled={disabled} onChange={onPick} />
          Choose files
        </label>
        {canPickFolder && (
          <label className={buttonClass}>
            <input ref={folderInput} type="file" multiple className="sr-only" disabled={disabled} onChange={onPick} />
            Choose folder
          </label>
        )}
        {onSample && !compact && (
          <button type="button" className={secondaryButton} disabled={disabled} onClick={onSample}>
            Try a sample
          </button>
        )}
      </div>

      {!canPickFolder && <p className="mt-4 text-sm text-amber-900">{FOLDER_PICKER_FALLBACK}</p>}
      {!canDropFolder && <p className="mt-4 text-sm text-amber-900">{FOLDER_DROP_FALLBACK}</p>}
    </section>
  )
}
