import { describe, expect, it } from 'vitest'
import { NOTICE_TEXT, buildReport, groupByFile } from '../src/lib/report'
import { sgPack } from '../src/rules'
import type { DoneMessage, Finding, WorkerToPage } from '../src/worker/protocol'
import { runScan } from '../src/worker/scan'
import dummyConfig from './fixtures/dummy-config.js?raw'
import dummyCustomers from './fixtures/dummy-customers.csv?raw'
import dummyReadme from './fixtures/dummy-README.md?raw'
import dummyChat from './fixtures/dummy-support-chat.txt?raw'

const msgs: WorkerToPage[] = []
runScan(
  {
    type: 'scan',
    files: [
      { path: 'dummy-README.md', text: dummyReadme },
      { path: 'dummy-support-chat.txt', text: dummyChat },
      { path: 'dummy-config.js', text: dummyConfig },
      { path: 'dummy-customers.csv', text: dummyCustomers },
    ],
    skipped: [{ path: 'logo.png', reason: 'binary' }],
  },
  (m) => msgs.push(m),
  sgPack,
)
const findings = msgs.flatMap((m) => (m.type === 'finding' ? [m.finding] : []))
const done = msgs.at(-1) as DoneMessage

describe('groupByFile', () => {
  it('puts files with blockers first, then sorts by path; findings by line', () => {
    const groups = groupByFile(findings)
    expect(groups.map((g) => g.path)).toEqual(['dummy-config.js', 'dummy-customers.csv', 'dummy-support-chat.txt'])
    for (const g of groups) {
      const lines = g.findings.map((f) => f.line)
      expect(lines).toEqual([...lines].sort((a, b) => a - b))
    }
  })
})

describe('buildReport (FR8)', () => {
  const text = buildReport(done, findings, [{ path: 'logo.png', reason: 'binary' }], sgPack.knownGaps)

  it('starts with the verdict and the scanned and skipped counts', () => {
    expect(text).toContain('Verdict: Likely blocked (4 scanned · 1 skipped)')
    expect(text).toContain('5 likely to block, 13 to review')
    expect(text).toContain('1 role email address(es) such as support@ were not flagged')
  })

  it('lists every finding with file, line, severity, label, masked value, reason and fix', () => {
    for (const f of findings) {
      expect(text).toContain(`== ${f.path} ==`)
      expect(text).toContain(`Line ${f.line}: [`)
      expect(text).toContain(`] ${f.label}: ${f.masked}`)
      expect(text).toContain(`Why: ${f.reason}`)
      expect(text).toContain(`Fix: ${f.fix}`)
    }
    expect(text.match(/^Line \d+:/gm)).toHaveLength(18)
  })

  it('lists skipped files, known gaps and the notice', () => {
    expect(text).toContain('Binary, PDF, image or archive: 1')
    expect(text).toContain('  - logo.png')
    expect(text).toContain('M-series FIN')
    expect(text).toContain(NOTICE_TEXT)
  })

  it('holds no raw secret or personal data', () => {
    for (const raw of ['AKIAIOSFODNN7EXAMPLE', 'sk_live_FAKE_0000_DUMMY_0000_NOT_REAL', 'Kopi-Siew-Dai-2026!', 'S8412369B', 'K1234567X', 'meiling.tan@example.com']) {
      expect(text).not.toContain(raw)
    }
  })

  it('a clean result still carries the counts and the notice', () => {
    const clean: DoneMessage = { ...done, totals: { blocker: 0, review: 0 }, verdict: 'no-issues', genericEmailsSkipped: 0 }
    const t = buildReport(clean, [] as Finding[], [], sgPack.knownGaps)
    expect(t).toContain('Verdict: No issues found in scanned files (4 scanned · 1 skipped)')
    expect(t).toContain(NOTICE_TEXT)
  })
})
