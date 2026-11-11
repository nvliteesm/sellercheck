import { describe, expect, it } from 'vitest'
import { isValidNric } from '../src/rules/nric'

describe('NRIC and FIN checksum', () => {
  // The three fixture values, plus an F-series value worked by hand:
  // F1234567: 1*2+2*7+3*6+4*5+5*4+6*3+7*2 = 106, 106 % 11 = 7, FG table[7] = N.
  it.each(['S8412369B', 'T0176542B', 'G5523817R', 'F1234567N'])('accepts valid %s', (id) => {
    expect(isValidNric(id)).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isValidNric('s8412369b')).toBe(true)
  })

  it.each(['S8412369A', 'T0176542C', 'G5523817X', 'F1234567K'])('rejects a wrong check letter: %s', (id) => {
    expect(isValidNric(id)).toBe(false)
  })

  it.each(['S841236B', 'S84123690B', 'X8412369B', '8412369B', 'S8412369'])('rejects bad shape: %s', (id) => {
    expect(isValidNric(id)).toBe(false)
  })

  it('does not support the M series (known gap)', () => {
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      expect(isValidNric(`M1234567${letter}`)).toBe(false)
    }
  })
})
