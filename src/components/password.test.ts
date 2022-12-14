import { isPasswordStrong, testPasswordDigits, testPasswordLength, testPasswordLowerCase, testPasswordSpecials, testPasswordUpperCase } from "./password"

test('testPasswordLength', () => {
  expect(testPasswordLength('ajksakn?')).toBeTruthy()
  expect(testPasswordLength('kj!kjfz')).toBeFalsy()
  expect(testPasswordLowerCase('')).toBeFalsy()
})

test('testPasswordUpperCase', () => {
  expect(testPasswordUpperCase('AA#')).toBeTruthy()
  expect(testPasswordUpperCase('KZ')).toBeTruthy()
  expect(testPasswordUpperCase('Chh')).toBeFalsy()
  expect(testPasswordUpperCase('sg')).toBeFalsy()
  expect(testPasswordLowerCase('')).toBeFalsy()
})

test('testPasswordLowerCase', () => {
  expect(testPasswordLowerCase('Bzzz')).toBeTruthy()
  expect(testPasswordLowerCase('cl%')).toBeTruthy()
  expect(testPasswordLowerCase('EI')).toBeFalsy()
  expect(testPasswordLowerCase('JKJKDLJFK143&')).toBeFalsy()
  expect(testPasswordLowerCase('')).toBeFalsy()
})

test('testPasswordDigits', () => {
  expect(testPasswordDigits('37137i21234J#')).toBeTruthy()
  expect(testPasswordDigits('37$')).toBeTruthy()
  expect(testPasswordDigits('3^')).toBeFalsy()
  expect(testPasswordDigits('')).toBeFalsy()
})

test('testPasswordSpecials', () => {
  expect(testPasswordSpecials('a8#/')).toBeTruthy()
  expect(testPasswordSpecials('k8AZluz71.')).toBeFalsy()
  expect(testPasswordSpecials('')).toBeFalsy()
})

test('isPasswordStrong', () => {
  expect(isPasswordStrong('ic{K6Bio"pMS7')).toBeTruthy()
  expect(isPasswordStrong('kjaksj8123jk8')).toBeFalsy()
  expect(isPasswordStrong('KJAKSJ8123JK8')).toBeFalsy()
})
