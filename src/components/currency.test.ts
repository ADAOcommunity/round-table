import { removeTrailingZero, toDecimal } from './currency'

test('toDecimal', () => {
  expect(toDecimal(BigInt(10000000), 6)).toBe('10.000000')
})

test('removeTrailingZero', () => {
  expect(removeTrailingZero('10000001.000100')).toBe('10000001.0001')
  expect(removeTrailingZero('10000001.0')).toBe('10000001')
  expect(removeTrailingZero('10000001')).toBe('10000001')
  expect(removeTrailingZero('10000000')).toBe('10000000')
})
