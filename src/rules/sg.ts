// Singapore rule pack, implementing the PRD v2 "Singapore rule specification" table.
//
// Severity principle: Blocker only where the format is specific enough that a match is almost
// certainly real. Anything heuristic is Review.
//
// Policy basis to confirm against PDPC guidance before publishing (owner: Steven Lim).

import type { MatchSkip, RulePack } from './index'
import { maskAfterPrefix, maskAll, maskEmail, maskMiddle } from './mask'
import { isValidNric } from './nric'

/** Values that look like placeholders rather than real secrets. Only the generic secret rule uses this. */
const PLACEHOLDER =
  /example|sample|changeme|change[_-]me|placeholder|your[_-]|replace|redacted|dummy|<[^>]*>|\$\{|\{\{|process\.env|os\.environ|getenv|x{4,}|\*{4,}|^(.)\1+$/i

export function isPlaceholder(value: string): boolean {
  return PLACEHOLDER.test(value)
}

/** Role addresses that are not personal data. They are skipped and counted. */
export const GENERIC_EMAIL_LOCAL_PARTS: ReadonlySet<string> = new Set([
  'info',
  'support',
  'help',
  'hello',
  'contact',
  'admin',
  'sales',
  'enquiries',
  'enquiry',
  'inquiries',
  'noreply',
  'no-reply',
  'donotreply',
  'team',
  'office',
  'hr',
  'billing',
  'accounts',
  'marketing',
  'careers',
  'jobs',
  'privacy',
  'security',
  'dpo',
  'feedback',
  'service',
  'customerservice',
  'webmaster',
  'press',
  'media',
])

export function isGenericEmail(email: string): boolean {
  const local = email.slice(0, email.lastIndexOf('@')).toLowerCase()
  return GENERIC_EMAIL_LOCAL_PARTS.has(local)
}

const TOKEN_PREFIX = /^(?:sk_live_|ghp_|xox[bp]-)/
const PHONE_PREFIX = /^(?:\+65|\(65\))[ -]?/
const ADDRESS_PREFIX = /^Singapore,?\s*/i

const PHONE_LABELS = 'phone|tel|telephone|mobile|mob|hp|handphone|contact|whatsapp|call|sms'

export const sgPack: RulePack = {
  id: 'sg',
  name: 'Singapore',
  rules: [
    // ---------- Blockers ----------
    {
      id: 'private-key',
      label: 'Private key',
      severity: 'blocker',
      pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g,
      // The header line holds no secret, so it is shown as is.
      mask: (v) => v,
      reason: 'A PEM private key is in this file. Anyone with it can impersonate the key owner.',
      fix: 'Remove the key from the file, rotate it, and load it from a secret store at runtime.',
    },
    {
      id: 'aws-access-key',
      label: 'Cloud access key',
      severity: 'blocker',
      pattern: /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}(?![A-Za-z0-9])/g,
      mask: (v) => maskMiddle(v, 4, 2),
      reason: 'This looks like an AWS access key ID, a known credential format.',
      fix: 'Remove it, deactivate the key in AWS IAM, and read credentials from the environment.',
    },
    {
      id: 'service-token',
      label: 'Service token',
      severity: 'blocker',
      // Underscores are allowed after the prefix (the fixture token uses them).
      pattern: /(?<![A-Za-z0-9_])(?:sk_live_|ghp_|xox[bp]-)[A-Za-z0-9_-]{16,}/g,
      mask: (v) => maskAfterPrefix(v, TOKEN_PREFIX, 0),
      reason: 'This looks like a live Stripe, GitHub or Slack token, a known credential format.',
      fix: 'Remove it, revoke the token with the provider, and read it from the environment.',
    },
    {
      id: 'nric-fin',
      label: 'NRIC or FIN',
      severity: 'blocker',
      pattern: /(?<![A-Za-z0-9])[STFG]\d{7}[A-Z](?![A-Za-z0-9])/gi,
      // Numbers that fail the checksum are ignored to cut false alarms. M series is a known gap.
      validate: isValidNric,
      mask: (v) => maskMiddle(v, 0, 4),
      reason:
        'This is a valid NRIC or FIN. PDPC guidance says organisations generally should not collect, use or disclose national ID numbers.',
      fix: 'Remove the column or replace each value with a random or hashed ID.',
    },

    // ---------- Review ----------
    {
      id: 'generic-secret',
      label: 'Password or secret in code',
      severity: 'review',
      pattern:
        /(?<![A-Za-z0-9])[A-Za-z0-9_.-]*?(?:password|passwd|pwd|secret|api[_-]?key|token)[A-Za-z0-9_-]*["']?\s*[:=]\s*(["'`])(?<value>(?:(?!\1)[^\r\n]){8,})\1/dgi,
      skip: (v): MatchSkip | undefined => (isPlaceholder(v) ? 'placeholder' : undefined),
      mask: () => maskAll(),
      reason: 'A password, secret, API key or token appears to be written into the code.',
      fix: 'If it is real, remove it, change it, and read it from the environment or a secret store.',
    },
    {
      id: 'env-secret',
      label: 'Password or secret in config file',
      severity: 'review',
      // Unquoted .env style lines, such as PASSWORD=abc12345 or export API_KEY=...
      // Quoted values are covered by generic-secret. Names must be upper case (the .env
      // convention) to keep ordinary code assignments out.
      pattern:
        /^\s*(?:export\s+)?[A-Z0-9_]*(?:PASSWORD|PASSWD|PWD|SECRET|API_?KEY|TOKEN)[A-Z0-9_]*\s*=\s*(?<value>[^\s"'`#]{8,})\s*(?:#.*)?$/dg,
      skip: (v): MatchSkip | undefined =>
        v.startsWith('$') || isPlaceholder(v) ? 'placeholder' : undefined,
      mask: () => maskAll(),
      reason: 'A password, secret, API key or token is set in a config or .env file.',
      fix: 'If it is real, remove the file from what you share, change the secret, and keep .env files out of the dataset.',
    },
    {
      id: 'passport',
      label: 'Passport number',
      severity: 'review',
      pattern: /(?<=\bpassport\b[^\r\n]{0,30}?)(?<![A-Za-z0-9])[A-Z]\d{7}[A-Z]?(?![A-Za-z0-9])/gi,
      mask: (v) => maskMiddle(v, 1, 1),
      reason: 'This looks like a passport number, which identifies a person.',
      fix: 'Remove it, or remove the record if it is not needed.',
    },
    {
      id: 'sg-phone',
      label: 'Singapore phone number',
      severity: 'review',
      pattern: new RegExp(
        String.raw`(?:\+65|\(65\))[ -]?\d{4}[ -]?\d{4}(?!\d)` +
          String.raw`|(?<=\b(?:${PHONE_LABELS})\b[^\d\r\n]{0,20})(?<![\d+])[689]\d{3}[ -]?\d{4}(?!\d)`,
        'gi',
      ),
      mask: (v) => maskAfterPrefix(v, PHONE_PREFIX, 4),
      reason: 'This looks like a Singapore phone number. A personal number is personal data.',
      fix: 'Remove it if it belongs to a person. A published business line may be fine.',
    },
    {
      id: 'email',
      label: 'Email address',
      severity: 'review',
      pattern:
        /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![A-Za-z0-9-])/g,
      skip: (v): MatchSkip | undefined => (isGenericEmail(v) ? 'generic-email' : undefined),
      mask: maskEmail,
      reason: 'This is an email address. A personal address is personal data.',
      fix: 'Remove it, or replace it with a role address such as support@.',
    },
    {
      id: 'sg-address',
      label: 'Singapore address',
      severity: 'review',
      pattern: /\bSingapore,?\s*\d{6}(?!\d)/gi,
      mask: (v) => maskAfterPrefix(v, ADDRESS_PREFIX, 2),
      reason: 'This looks like a Singapore postal address, which can identify where a person lives.',
      fix: 'Remove it, or keep only a coarse area if the data needs a location.',
    },
  ],
  knownGaps: [
    {
      label: 'M-series FIN',
      why: 'Format and checksum not confirmed from an official source.',
    },
    { label: 'Personal names', why: 'Needs dictionaries or AI, with a high false-positive rate.' },
    { label: 'JSON Web Tokens', why: 'Often hold no secret; severity not decided.' },
    {
      label: 'Cloud keys beyond AWS (GCP, Azure and others)',
      why: 'Scope kept small for version 1.',
    },
    { label: 'Payment card numbers', why: 'Needs a Luhn check and a test-card skip list.' },
    {
      label: 'Unquoted secrets with lower-case names (for example password=... in .ini or .properties files)',
      why: 'Matching lower-case names would also flag ordinary code assignments.',
    },
  ],
}
