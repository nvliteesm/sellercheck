// File intake (FR1, FR2). Collects files from the file picker, folder picker or a drop, decides
// which to skip and why, and reads the rest as text. Everything stays in the browser.

import type { ScanFile, SkippedFile, SkipReason } from '../worker/protocol'

export const IGNORED_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'vendor',
  '__pycache__',
])

/** 1.5 MB. */
export const MAX_FILE_BYTES = 1.5 * 1024 * 1024
export const MAX_FILES = 3000
/** Bytes checked for a NUL byte, which marks a file as binary. */
const SNIFF_BYTES = 8192

export const BINARY_EXTENSIONS: ReadonlySet<string> = new Set(
  (
    'png jpg jpeg gif bmp ico webp tif tiff heic psd svgz avif ' +
    'pdf doc docx xls xlsx ppt pptx odt ods key numbers pages ' +
    'zip gz tgz bz2 xz 7z rar tar jar war ear whl ' +
    'exe dll so dylib bin o a class pyc pyo wasm dmg iso apk ipa ' +
    'mp3 mp4 m4a mov avi mkv wav flac ogg webm ' +
    'woff woff2 ttf otf eot ' +
    'sqlite sqlite3 db parquet avro orc feather pkl npy npz h5'
  ).split(' '),
)

export const SKIP_REASON_TEXT: Readonly<Record<SkipReason, string>> = {
  'ignored-folder': 'Ignored folder (node_modules, .git, build output and similar)',
  binary: 'Binary, PDF, image or archive',
  'too-large': 'Larger than 1.5 MB',
  'file-cap': 'Over the 3,000-file limit',
  unreadable: 'Could not be read',
}

/** A file waiting to be read. `read` is only called for files that are not skipped. */
export interface IntakeFile {
  readonly path: string
  readonly size: number
  readonly read: () => Promise<ArrayBuffer>
}

export interface Intake {
  readonly files: ScanFile[]
  readonly skipped: SkippedFile[]
}

const segments = (path: string) => path.split('/').filter(Boolean)

/**
 * The ignored folder a path sits in, such as "app/node_modules/", or undefined.
 * Only folders count: a file named "build" is not skipped.
 */
export function ignoredFolderOf(path: string): string | undefined {
  const parts = segments(path)
  for (let i = 0; i < parts.length - 1; i++) {
    if (IGNORED_DIRS.has(parts[i]!)) return `${parts.slice(0, i + 1).join('/')}/`
  }
  return undefined
}

export function extensionOf(path: string): string {
  const name = segments(path).at(-1) ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/**
 * Decide, without reading anything, which files to read and which to skip.
 * An ignored folder is listed once, however many files it holds.
 */
export function triage(
  entries: readonly IntakeFile[],
  preSkipped: readonly SkippedFile[] = [],
): { accepted: IntakeFile[]; skipped: SkippedFile[] } {
  const accepted: IntakeFile[] = []
  const skipped: SkippedFile[] = [...preSkipped]
  const listedFolders = new Set(preSkipped.filter((s) => s.reason === 'ignored-folder').map((s) => s.path))

  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  for (const entry of sorted) {
    const folder = ignoredFolderOf(entry.path)
    if (folder) {
      if (!listedFolders.has(folder)) {
        listedFolders.add(folder)
        skipped.push({ path: folder, reason: 'ignored-folder' })
      }
      continue
    }
    let reason: SkipReason | undefined
    if (BINARY_EXTENSIONS.has(extensionOf(entry.path))) reason = 'binary'
    else if (entry.size > MAX_FILE_BYTES) reason = 'too-large'
    else if (accepted.length >= MAX_FILES) reason = 'file-cap'
    if (reason) skipped.push({ path: entry.path, reason })
    else accepted.push(entry)
  }
  return { accepted, skipped }
}

function looksBinary(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.length, SNIFF_BYTES)
  for (let i = 0; i < end; i++) if (bytes[i] === 0) return true
  return false
}

/** UTF-16 text (for example Excel's "Unicode Text" export) has NUL bytes but a byte order mark. */
function utf16Encoding(bytes: Uint8Array): 'utf-16le' | 'utf-16be' | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le'
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be'
  return undefined
}

/** Triage, then read the accepted files as text (UTF-8, or UTF-16 with a byte order mark). */
export async function readIntake(
  entries: readonly IntakeFile[],
  preSkipped: readonly SkippedFile[] = [],
  isCancelled: () => boolean = () => false,
): Promise<Intake> {
  const { accepted, skipped } = triage(entries, preSkipped)
  const files: ScanFile[] = []
  const decoder = new TextDecoder('utf-8')
  for (const entry of accepted) {
    if (isCancelled()) break
    try {
      const bytes = new Uint8Array(await entry.read())
      const utf16 = utf16Encoding(bytes)
      if (utf16) files.push({ path: entry.path, text: new TextDecoder(utf16).decode(bytes) })
      else if (looksBinary(bytes)) skipped.push({ path: entry.path, reason: 'binary' })
      else files.push({ path: entry.path, text: decoder.decode(bytes) })
    } catch {
      skipped.push({ path: entry.path, reason: 'unreadable' })
    }
  }
  return { files, skipped }
}

// ---------- Sources ----------

/** Files from <input type="file">, with or without the folder attribute. */
export function fromFileList(list: Iterable<File>): IntakeFile[] {
  return Array.from(list, (f) => ({
    path: f.webkitRelativePath || f.name,
    size: f.size,
    read: () => f.arrayBuffer(),
  }))
}

/** Files handled between yields to the page while building the list. */
const LIST_BATCH = 100
const yieldToPage = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * Like fromFileList, but yields to the page every LIST_BATCH files. Chromium checks each file on
 * disk the first time its size is read, which froze the page for about a second on 1,000 files.
 */
export async function fromFileListAsync(list: Iterable<File>): Promise<IntakeFile[]> {
  const files = Array.from(list)
  const out: IntakeFile[] = []
  for (let i = 0; i < files.length; i += LIST_BATCH) {
    if (i > 0) await yieldToPage()
    out.push(...fromFileList(files.slice(i, i + LIST_BATCH)))
  }
  return out
}

export function supportsFolderPicker(): boolean {
  return typeof HTMLInputElement !== 'undefined' && 'webkitdirectory' in HTMLInputElement.prototype
}

export function supportsFolderDrop(): boolean {
  return typeof DataTransferItem !== 'undefined' && 'webkitGetAsEntry' in DataTransferItem.prototype
}

const fileOf = (entry: FileSystemFileEntry) =>
  new Promise<File>((resolve, reject) => entry.file(resolve, reject))

async function readAllEntries(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = dir.createReader()
  const all: FileSystemEntry[] = []
  // readEntries returns results in batches until it returns an empty one.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
    if (batch.length === 0) return all
    all.push(...batch)
  }
}

const stripSlash = (p: string) => p.replace(/^\/+/, '')

/**
 * Walk dropped entries. Ignored folders are not opened: they are listed as skipped once.
 * Entries that cannot be read are listed as unreadable.
 */
export async function walkEntries(
  roots: readonly FileSystemEntry[],
): Promise<{ entries: IntakeFile[]; skipped: SkippedFile[] }> {
  const entries: IntakeFile[] = []
  const skipped: SkippedFile[] = []

  const visit = async (entry: FileSystemEntry): Promise<void> => {
    const path = stripSlash(entry.fullPath || entry.name)
    if (entry.isDirectory) {
      if (IGNORED_DIRS.has(entry.name)) {
        skipped.push({ path: `${path}/`, reason: 'ignored-folder' })
        return
      }
      try {
        for (const child of await readAllEntries(entry as FileSystemDirectoryEntry)) await visit(child)
      } catch {
        skipped.push({ path: `${path}/`, reason: 'unreadable' })
      }
      return
    }
    if (entry.isFile) {
      try {
        const file = await fileOf(entry as FileSystemFileEntry)
        entries.push({ path, size: file.size, read: () => file.arrayBuffer() })
      } catch {
        skipped.push({ path, reason: 'unreadable' })
      }
    }
  }

  for (const root of roots) await visit(root)
  return { entries, skipped }
}

/**
 * Files from a drop. Uses the folder API where the browser has it; otherwise falls back to the
 * plain file list, in which case dropped folders cannot be read.
 */
export async function fromDataTransfer(
  dt: DataTransfer,
): Promise<{ entries: IntakeFile[]; skipped: SkippedFile[]; usedFallback: boolean }> {
  const items = Array.from(dt.items ?? []).filter((i) => i.kind === 'file')
  if (items.length > 0 && typeof items[0]!.webkitGetAsEntry === 'function') {
    // Entries must be taken synchronously, before any await, or the browser clears them.
    const roots: FileSystemEntry[] = []
    const loose: File[] = []
    for (const item of items) {
      const entry = item.webkitGetAsEntry()
      if (entry) roots.push(entry)
      else {
        const f = item.getAsFile()
        if (f) loose.push(f)
      }
    }
    const walked = await walkEntries(roots)
    return { entries: [...walked.entries, ...fromFileList(loose)], skipped: walked.skipped, usedFallback: false }
  }
  return { entries: fromFileList(Array.from(dt.files ?? [])), skipped: [], usedFallback: true }
}
