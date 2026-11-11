import { describe, expect, it } from 'vitest'
import {
  type DoneMessage,
  type Finding,
  type WorkerToPage,
  countSkipped,
  countsText,
  isPageToWorker,
  isWorkerToPage,
  verdictFor,
  VERDICT_TEXT,
} from '../src/worker/protocol'

const finding: Finding = {
  path: 'dummy-config.js',
  line: 8,
  column: 18,
  ruleId: 'aws-access-key',
  severity: 'blocker',
  label: 'Cloud access key',
  masked: 'AKIA••••••••••••••LE',
  reason: 'r',
  fix: 'f',
}

const done: DoneMessage = {
  type: 'done',
  totals: { blocker: 0, review: 0 },
  scanned: 212,
  skipped: 38,
  skippedByReason: { 'ignored-folder': 30, binary: 5, 'too-large': 3, 'file-cap': 0, unreadable: 0 },
  genericEmailsSkipped: 0,
  verdict: 'no-issues',
}

describe('verdict rule', () => {
  it('any blocker gives Likely blocked', () => {
    expect(verdictFor({ blocker: 1, review: 9 })).toBe('likely-blocked')
  })
  it('review items only give Needs review', () => {
    expect(verdictFor({ blocker: 0, review: 1 })).toBe('needs-review')
  })
  it('nothing gives "No issues found in scanned files", shown with counts', () => {
    const v = verdictFor({ blocker: 0, review: 0 })
    expect(VERDICT_TEXT[v]).toBe('No issues found in scanned files')
    expect(countsText(212, 38)).toBe('212 scanned · 38 skipped')
  })
})

describe('countSkipped', () => {
  it('counts every reason, including zeros', () => {
    expect(
      countSkipped([
        { path: 'node_modules/a.js', reason: 'ignored-folder' },
        { path: 'logo.png', reason: 'binary' },
        { path: 'b.png', reason: 'binary' },
      ]),
    ).toEqual({ 'ignored-folder': 1, binary: 2, 'too-large': 0, 'file-cap': 0, unreadable: 0 })
  })
})

describe('isPageToWorker', () => {
  it('accepts a scan message', () => {
    expect(
      isPageToWorker({
        type: 'scan',
        files: [{ path: 'a.txt', text: 'hi' }],
        skipped: [{ path: 'b.png', reason: 'binary' }],
      }),
    ).toBe(true)
  })
  it.each([
    null,
    'scan',
    { type: 'cancel' },
    { type: 'scan', files: [{ path: 'a' }], skipped: [] },
    { type: 'scan', files: [], skipped: [{ path: 'b', reason: 'nope' }] },
    { type: 'scan', files: [] },
  ])('rejects %j', (msg) => {
    expect(isPageToWorker(msg)).toBe(false)
  })
})

describe('isWorkerToPage', () => {
  const valid: WorkerToPage[] = [
    { type: 'ready' },
    { type: 'start', index: 0, total: 4, path: 'a' },
    { type: 'finding', finding },
    { type: 'progress', done: 1, total: 4, findingsInFile: 3 },
    done,
  ]
  it.each(valid)('accepts $type', (msg) => {
    expect(isWorkerToPage(msg)).toBe(true)
  })

  it.each([
    { type: 'hello' },
    { type: 'start', index: -1, total: 4, path: 'a' },
    { type: 'finding', finding: { ...finding, severity: 'high' } },
    { type: 'finding', finding: { ...finding, line: 0 } },
    { type: 'finding', finding: { ...finding, masked: undefined } },
    { type: 'progress', done: 1.5, total: 4, findingsInFile: 0 },
    { ...done, verdict: 'clean' },
    { ...done, skippedByReason: { binary: 1 } },
  ])('rejects %j', (msg) => {
    expect(isWorkerToPage(msg)).toBe(false)
  })
})
