import { describe, expect, it } from 'vitest'
import { MAX_LINE_LENGTH, scanText, sgPack, totalsOf } from '../src/rules'
import { MASK_CHAR, maskAfterPrefix, maskAll, maskEmail, maskMiddle } from '../src/rules/mask'
import { verdictFor } from '../src/worker/protocol'
import dummyConfig from './fixtures/dummy-config.js?raw'
import dummyCustomers from './fixtures/dummy-customers.csv?raw'
import dummyReadme from './fixtures/dummy-README.md?raw'
import dummyChat from './fixtures/dummy-support-chat.txt?raw'

const scan = (text: string) => scanText('t.txt', text, sgPack)
const ids = (text: string) => scan(text).findings.map((f) => f.ruleId)

describe('rule pack shape', () => {
  it('every pattern is global, and patterns with a value group have the d flag', () => {
    for (const r of sgPack.rules) {
      expect(r.pattern.flags, r.id).toContain('g')
      if (r.pattern.source.includes('(?<value>')) expect(r.pattern.flags, r.id).toContain('d')
    }
  })

  it('has exactly the PRD v2 rules and severities', () => {
    expect(Object.fromEntries(sgPack.rules.map((r) => [r.id, r.severity]))).toEqual({
      'private-key': 'blocker',
      'aws-access-key': 'blocker',
      'service-token': 'blocker',
      'nric-fin': 'blocker',
      'generic-secret': 'review',
      passport: 'review',
      'sg-phone': 'review',
      email: 'review',
      'sg-address': 'review',
    })
  })

  it('lists M-series FIN as a known gap', () => {
    expect(sgPack.knownGaps.map((g) => g.label)).toContain('M-series FIN')
  })
})

describe('blocker rules', () => {
  it('cloud access key', () => {
    expect(ids("key = 'AKIAABCDEFGHIJKLMNOP'")).toEqual(['aws-access-key'])
    expect(ids('AKIAABCDEFGHIJKLMNO')).toEqual([]) // 15 characters after AKIA
    expect(ids('XAKIAABCDEFGHIJKLMNOP')).toEqual([])
  })

  it.each([
    '-----BEGIN PRIVATE KEY-----',
    '-----BEGIN RSA PRIVATE KEY-----',
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    '-----BEGIN EC PRIVATE KEY-----',
  ])('private key: %s', (line) => {
    expect(ids(line)).toEqual(['private-key'])
  })

  it('ignores a public key header', () => {
    expect(ids('-----BEGIN PUBLIC KEY-----')).toEqual([])
  })

  it.each([
    'sk_live_FAKE_0000_DUMMY_0000_NOT_REAL',
    'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    'xoxb-1234567890-0987654321-abcdefABCDEF',
    'xoxp-1234567890-0987654321-abcdefABCDEF',
  ])('service token: %s', (token) => {
    expect(ids(`const t = "${token}"`)).toEqual(['service-token'])
  })

  it('ignores test-mode Stripe keys and short prefixes', () => {
    expect(ids('sk_test_ABCDEFGHIJKLMNOPQRSTUV')).toEqual([])
    expect(ids('ghp_short')).toEqual([])
  })

  it('NRIC or FIN only when the checksum passes', () => {
    expect(ids('id S8412369B')).toEqual(['nric-fin'])
    expect(ids('id S8412369A')).toEqual([])
    expect(ids('order S8412369B1')).toEqual([])
  })

  it('does not flag M-series FIN (known gap)', () => {
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      expect(ids(`fin M1234567${letter}`)).toEqual([])
    }
  })

  it('a token assigned to a secret name is one blocker, not also a review item', () => {
    expect(ids('token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"')).toEqual(['service-token'])
  })
})

describe('password or secret in code', () => {
  it.each([
    "password: 'Kopi-Siew-Dai-2026!'",
    'DB_PASSWORD = "hunter2hunter2"',
    'client_secret="abcd1234efgh"',
    "apiKey: 'q8w7e6r5t4y3'",
    'api_key = `zxcvbnm123`',
    'authToken: "a1b2c3d4e5f6"',
  ])('flags %s as review', (line) => {
    const r = scan(line)
    expect(r.findings.map((f) => [f.ruleId, f.severity])).toEqual([['generic-secret', 'review']])
  })

  it('reports the column of the value, not the key name', () => {
    const [f] = scan("    password: 'Kopi-Siew-Dai-2026!',").findings
    expect(f?.column).toBe("    password: '".length + 1)
  })

  it('needs 8 or more characters', () => {
    expect(ids("password: 'short'")).toEqual([])
  })

  it.each([
    "password: 'example-password'",
    "password: 'changeme123'",
    "secret: 'your_secret_here'",
    'password: "${DB_PASSWORD}"',
    "password: '<your password>'",
    "token: 'process.env.TOKEN'",
    "password: 'xxxxxxxxxx'",
    "password: '********'",
  ])('skips placeholder %s', (line) => {
    const r = scan(line)
    expect(r.findings).toEqual([])
    expect(r.skippedMatches.placeholder).toBe(1)
  })

  it('does not apply the placeholder skip to known key formats', () => {
    expect(ids("accessKeyId: 'AKIAIOSFODNN7EXAMPLE'")).toEqual(['aws-access-key'])
  })
})

describe('personal data review rules', () => {
  it('passport number after the word passport', () => {
    expect(ids('My passport is K1234567X.')).toEqual(['passport'])
    expect(ids('Passport no: E1234567')).toEqual(['passport'])
    expect(ids('Order K1234567X shipped')).toEqual([])
  })

  it.each(['+65 9123 4567', '+6581234567', '(65) 6345-6789', 'mobile: 9123 4567', 'Tel 61234567', 'HP: 8765-4321'])(
    'Singapore phone: %s',
    (text) => {
      expect(ids(text)).toEqual(['sg-phone'])
    },
  )

  it('ignores an unlabelled 8-digit number and a labelled one with the wrong first digit', () => {
    expect(ids('invoice 91234567')).toEqual([])
    expect(ids('phone: 51234567')).toEqual([])
  })

  it('email address', () => {
    expect(ids('reach me at wei.jie.lim@example.com')).toEqual(['email'])
  })

  it.each(['support@example.com', 'info@shop.sg', 'NoReply@example.com'])('skips and counts generic %s', (email) => {
    const r = scan(`contact ${email}`)
    expect(r.findings).toEqual([])
    expect(r.skippedMatches['generic-email']).toBe(1)
  })

  it('Singapore address', () => {
    expect(ids('12 Jalan Dummy, Singapore 123456')).toEqual(['sg-address'])
    expect(ids('Singapore, 123456')).toEqual(['sg-address'])
    expect(ids('Singapore 12345')).toEqual([])
    expect(ids('Singapore dollars')).toEqual([])
  })
})

describe('masking', () => {
  it('helpers', () => {
    expect(maskMiddle('AKIAIOSFODNN7EXAMPLE', 4, 2)).toBe(`AKIA${MASK_CHAR.repeat(14)}LE`)
    expect(maskMiddle('S8412369B', 0, 4)).toBe(`${MASK_CHAR.repeat(5)}369B`)
    expect(maskMiddle('ab', 5, 5)).toBe(`${MASK_CHAR}b`) // never reveals everything
    expect(maskAll()).toBe(MASK_CHAR.repeat(8))
    expect(maskEmail('meiling.tan@example.com')).toBe(`m${MASK_CHAR.repeat(3)}@example.com`)
    expect(maskAfterPrefix('+65 9123 4567', /^\+65 /, 4)).toBe(`+65 ${MASK_CHAR.repeat(4)} 4567`)
  })

  it('no finding carries a full key, token, NRIC, password, passport or email', () => {
    const secrets = [
      'AKIAIOSFODNN7EXAMPLE',
      'sk_live_FAKE_0000_DUMMY_0000_NOT_REAL',
      'S8412369B',
      'Kopi-Siew-Dai-2026!',
      'K1234567X',
      'wei.jie.lim@example.com',
      '9123 4567',
      '123456',
    ]
    const text = [
      "accessKeyId: 'AKIAIOSFODNN7EXAMPLE',",
      "stripeKey: 'sk_live_FAKE_0000_DUMMY_0000_NOT_REAL',",
      "password: 'Kopi-Siew-Dai-2026!',",
      'S8412369B,+65 9123 4567,wei.jie.lim@example.com,"Singapore 123456"',
      'passport is K1234567X',
    ].join('\n')
    const out = JSON.stringify(scan(text).findings)
    expect(scan(text).findings).toHaveLength(8)
    for (const s of secrets) expect(out).not.toContain(s)
  })
})

describe('engine', () => {
  it('reports 1-based line and column', () => {
    const [f] = scan('first line\n  id S8412369B').findings
    expect(f).toMatchObject({ line: 2, column: 6, path: 't.txt' })
  })

  it('handles CRLF and CR line endings', () => {
    expect(scan('a\r\nb\rS8412369B').findings[0]?.line).toBe(3)
  })

  it(`reads a line only to ${MAX_LINE_LENGTH} characters`, () => {
    const before = 'a'.repeat(MAX_LINE_LENGTH - 20) + ' S8412369B'
    const after = 'a'.repeat(MAX_LINE_LENGTH) + ' S8412369B'
    expect(scan(before).findings).toHaveLength(1)
    const r = scan(after)
    expect(r.findings).toHaveLength(0)
    expect(r.truncatedLines).toBe(1)
  })

  it('is stable across repeated calls (no regex state leaks)', () => {
    const text = 'S8412369B T0176542B'
    expect(scan(text).findings).toHaveLength(2)
    expect(scan(text).findings).toHaveLength(2)
  })

  it('every finding has all seven FR5 fields', () => {
    for (const f of scan("S8412369B +65 9123 4567 password: 'Kopi-Siew-Dai-2026!'").findings) {
      for (const k of ['path', 'line', 'severity', 'label', 'masked', 'reason', 'fix'] as const) {
        expect(f[k], `${f.ruleId}.${k}`).toBeTruthy()
      }
    }
  })
})

describe('dummy fixtures (PRD v2 appendix)', () => {
  const files: Record<string, string> = {
    'dummy-config.js': dummyConfig,
    'dummy-customers.csv': dummyCustomers,
    'dummy-support-chat.txt': dummyChat,
    'dummy-README.md': dummyReadme,
  }
  const results = Object.fromEntries(
    Object.entries(files).map(([name, text]) => [name, scanText(name, text, sgPack)]),
  )
  const per = (name: string) => totalsOf(results[name]!.findings)

  it('dummy-config.js: 2 blockers, 1 review', () => {
    expect(per('dummy-config.js')).toEqual({ blocker: 2, review: 1 })
    expect(results['dummy-config.js']!.findings.map((f) => f.ruleId)).toEqual([
      'aws-access-key',
      'service-token',
      'generic-secret',
    ])
  })

  it('dummy-customers.csv: 3 blockers, 9 review', () => {
    expect(per('dummy-customers.csv')).toEqual({ blocker: 3, review: 9 })
    const count = (id: string) => results['dummy-customers.csv']!.findings.filter((f) => f.ruleId === id).length
    expect([count('nric-fin'), count('sg-phone'), count('email'), count('sg-address')]).toEqual([3, 3, 3, 3])
  })

  it('dummy-support-chat.txt: 3 review (phone, email, passport)', () => {
    expect(per('dummy-support-chat.txt')).toEqual({ blocker: 0, review: 3 })
    expect(results['dummy-support-chat.txt']!.findings.map((f) => f.ruleId)).toEqual(['sg-phone', 'email', 'passport'])
  })

  it('dummy-README.md: 0 findings, 1 generic email skipped', () => {
    expect(results['dummy-README.md']!.findings).toEqual([])
    expect(results['dummy-README.md']!.skippedMatches['generic-email']).toBe(1)
  })

  it('all four: 5 blockers, 13 review, 1 generic email skipped, Likely blocked', () => {
    const all = Object.values(results)
    const totals = totalsOf(all.flatMap((r) => r.findings))
    expect(totals).toEqual({ blocker: 5, review: 13 })
    expect(all.reduce((n, r) => n + r.skippedMatches['generic-email'], 0)).toBe(1)
    expect(verdictFor(totals)).toBe('likely-blocked')
  })
})
