// NRIC and FIN checksum for the S, T, F and G series.
//
// Weights 2,7,6,5,4,3,2 over the seven digits; add 4 for T and G; take the sum mod 11 and
// look up the check letter in the series table. The M series is deliberately not supported:
// its checksum is not confirmed from an official source (PRD v2, known gaps).

const WEIGHTS = [2, 7, 6, 5, 4, 3, 2] as const
const ST_LETTERS = 'JZIHGFEDCBA'
const FG_LETTERS = 'XWUTRQPNMLK'

const SHAPE = /^[STFG]\d{7}[A-Z]$/

/** True when `id` is an S, T, F or G series NRIC/FIN whose check letter is correct. Case-insensitive. */
export function isValidNric(id: string): boolean {
  const s = id.toUpperCase()
  if (!SHAPE.test(s)) return false
  const prefix = s[0]
  let sum = prefix === 'T' || prefix === 'G' ? 4 : 0
  for (let i = 0; i < 7; i++) sum += Number(s[i + 1]) * WEIGHTS[i]!
  const table = prefix === 'S' || prefix === 'T' ? ST_LETTERS : FG_LETTERS
  return table[sum % 11] === s[8]
}
