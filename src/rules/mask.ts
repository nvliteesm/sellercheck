// Masking runs inside the worker, so no full key, NRIC or password reaches the page (FR7).

export const MASK_CHAR = '•'

/**
 * Keep the first `start` and last `end` letters or digits; replace every other letter or digit
 * with MASK_CHAR. Punctuation and spaces are kept so the shape stays readable.
 * At least half of the letters and digits are always masked.
 */
export function maskMiddle(value: string, start: number, end: number): string {
  const chars = [...value]
  const alnum: number[] = []
  chars.forEach((c, i) => {
    if (/[A-Za-z0-9]/.test(c)) alnum.push(i)
  })
  if (alnum.length === 0) return value
  let s = start
  let e = end
  while (s + e > Math.floor(alnum.length / 2)) {
    if (s >= e) s -= 1
    else e -= 1
  }
  const hide = new Set(alnum.slice(s, alnum.length - e))
  return chars.map((c, i) => (hide.has(i) ? MASK_CHAR : c)).join('')
}

/** Mask every character, with a fixed length so the value's length is not revealed. */
export function maskAll(): string {
  return MASK_CHAR.repeat(8)
}

/** Keep the first letter of the local part and the whole domain: m•••@example.com. */
export function maskEmail(value: string): string {
  const at = value.lastIndexOf('@')
  if (at < 1) return maskMiddle(value, 1, 0)
  return `${value[0]}${MASK_CHAR.repeat(3)}${value.slice(at)}`
}

/** Keep a known prefix (such as sk_live_ or the +65 country code) and mask the rest, keeping `end`. */
export function maskAfterPrefix(value: string, prefix: RegExp, end: number): string {
  const m = prefix.exec(value)
  const head = m && m.index === 0 ? m[0] : ''
  return head + maskMiddle(value.slice(head.length), 0, end)
}
