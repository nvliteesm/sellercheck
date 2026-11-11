import { describe, expect, it, vi } from 'vitest'
import {
  type IntakeFile,
  MAX_FILE_BYTES,
  MAX_FILES,
  fromDataTransfer,
  ignoredFolderOf,
  readIntake,
  triage,
  walkEntries,
} from '../src/lib/readFiles'

const enc = new TextEncoder()
const file = (path: string, text = 'hello', size = text.length): IntakeFile => ({
  path,
  size,
  read: async () => enc.encode(text).buffer as ArrayBuffer,
})

describe('ignoredFolderOf', () => {
  it.each([
    ['app/node_modules/react/index.js', 'app/node_modules/'],
    ['.git/config', '.git/'],
    ['src/__pycache__/a.pyc', 'src/__pycache__/'],
    ['web/.next/server/page.js', 'web/.next/'],
    ['dist/bundle.js', 'dist/'],
  ])('%s is inside %s', (path, folder) => {
    expect(ignoredFolderOf(path)).toBe(folder)
  })

  it.each(['src/build.ts', 'build', 'docs/vendors.md', 'distance/x.txt'])('%s is not skipped', (path) => {
    expect(ignoredFolderOf(path)).toBeUndefined()
  })
})

describe('triage (FR2)', () => {
  it('lists each ignored folder once, and skips binaries and large files', () => {
    const { accepted, skipped } = triage([
      file('repo/node_modules/a/index.js'),
      file('repo/node_modules/b/index.js'),
      file('repo/.git/HEAD'),
      file('repo/logo.PNG'),
      file('repo/report.pdf'),
      file('repo/dump.sql', 'x', MAX_FILE_BYTES + 1),
      file('repo/edge.txt', 'x', MAX_FILE_BYTES),
      file('repo/src/app.ts'),
    ])
    expect(accepted.map((f) => f.path)).toEqual(['repo/edge.txt', 'repo/src/app.ts'])
    expect(skipped).toEqual([
      { path: 'repo/.git/', reason: 'ignored-folder' },
      { path: 'repo/dump.sql', reason: 'too-large' },
      { path: 'repo/logo.PNG', reason: 'binary' },
      { path: 'repo/node_modules/', reason: 'ignored-folder' },
      { path: 'repo/report.pdf', reason: 'binary' },
    ])
  })

  it(`caps at ${MAX_FILES} files and lists the rest as file-cap`, () => {
    const many = Array.from({ length: MAX_FILES + 5 }, (_, i) => file(`f/${String(i).padStart(5, '0')}.txt`))
    const { accepted, skipped } = triage(many)
    expect(accepted).toHaveLength(MAX_FILES)
    expect(skipped).toHaveLength(5)
    expect(skipped.every((s) => s.reason === 'file-cap')).toBe(true)
  })

  it('does not list a folder twice when the drop walk already skipped it', () => {
    const { skipped } = triage([file('a/node_modules/x.js')], [{ path: 'a/node_modules/', reason: 'ignored-folder' }])
    expect(skipped).toEqual([{ path: 'a/node_modules/', reason: 'ignored-folder' }])
  })
})

describe('readIntake', () => {
  it('reads text as UTF-8, sniffs binary content and reports unreadable files', async () => {
    const binary: IntakeFile = { path: 'data.txt', size: 4, read: async () => new Uint8Array([65, 0, 66, 67]).buffer }
    const broken: IntakeFile = { path: 'locked.txt', size: 1, read: () => Promise.reject(new Error('denied')) }
    const intake = await readIntake([file('a.txt', 'Café S8412369B'), binary, broken])
    expect(intake.files).toEqual([{ path: 'a.txt', text: 'Café S8412369B' }])
    expect(intake.skipped).toEqual([
      { path: 'data.txt', reason: 'binary' },
      { path: 'locked.txt', reason: 'unreadable' },
    ])
  })

  it('stops reading when cancelled', async () => {
    let calls = 0
    const intake = await readIntake([file('a.txt'), file('b.txt')], [], () => calls++ > 0)
    expect(intake.files.map((f) => f.path)).toEqual(['a.txt'])
  })
})

// Minimal stand-ins for the browser's FileSystemEntry API.
function fakeFile(fullPath: string, text: string, fail = false) {
  const name = fullPath.split('/').at(-1)!
  return {
    isFile: true,
    isDirectory: false,
    name,
    fullPath,
    file: (ok: (f: File) => void, err: (e: Error) => void) => (fail ? err(new Error('no')) : ok(new File([text], name))),
  }
}
function fakeDir(fullPath: string, children: unknown[], batch = 1) {
  const createReader = vi.fn(() => {
    let i = 0
    return {
      readEntries: (ok: (e: unknown[]) => void) => {
        const out = children.slice(i, i + batch)
        i += batch
        ok(out)
      },
    }
  })
  return { isFile: false, isDirectory: true, name: fullPath.split('/').at(-1)!, fullPath, createReader }
}

describe('walkEntries (folder drop)', () => {
  it('walks folders in batches and does not open ignored folders', async () => {
    const nodeModules = fakeDir('/proj/node_modules', [fakeFile('/proj/node_modules/x.js', 'x')])
    const root = fakeDir(
      '/proj',
      [fakeFile('/proj/a.txt', 'A'), fakeDir('/proj/src', [fakeFile('/proj/src/b.ts', 'B')]), nodeModules, fakeFile('/proj/bad.txt', '', true)],
      2,
    )
    const { entries, skipped } = await walkEntries([root as unknown as FileSystemEntry])
    expect(entries.map((e) => e.path)).toEqual(['proj/a.txt', 'proj/src/b.ts'])
    expect(skipped).toEqual([
      { path: 'proj/node_modules/', reason: 'ignored-folder' },
      { path: 'proj/bad.txt', reason: 'unreadable' },
    ])
    expect(nodeModules.createReader).not.toHaveBeenCalled()
    expect(new TextDecoder().decode(await entries[1]!.read())).toBe('B')
  })
})

describe('fromDataTransfer', () => {
  it('falls back to the plain file list when the folder API is missing', async () => {
    const dt = { items: [], files: [new File(['hi'], 'a.txt')] } as unknown as DataTransfer
    const r = await fromDataTransfer(dt)
    expect(r.usedFallback).toBe(true)
    expect(r.entries.map((e) => e.path)).toEqual(['a.txt'])
  })

  it('uses the folder API when the browser has it', async () => {
    const entry = fakeFile('/notes.txt', 'n')
    const dt = {
      items: [{ kind: 'file', webkitGetAsEntry: () => entry, getAsFile: () => null }],
      files: [],
    } as unknown as DataTransfer
    const r = await fromDataTransfer(dt)
    expect(r.usedFallback).toBe(false)
    expect(r.entries.map((e) => e.path)).toEqual(['notes.txt'])
  })
})
