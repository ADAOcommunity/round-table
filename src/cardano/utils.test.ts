import { formatDerivationPath, decryptWithPassword, encryptWithPassword, estimateDateBySlot, estimateSlotByDate, getEpochBySlot, getSlotInEpochBySlot, harden, parseDerivationPath } from "./utils"

test('estimateSlotByDate', () => {
  expect(estimateSlotByDate(new Date('2022-04-21T22:26:39.000Z'), 'mainnet')).toBe(59013708)
  expect(estimateSlotByDate(new Date('2022-04-21T22:28:04.000Z'), 'testnet')).toBe(56210868)
  expect(estimateSlotByDate(new Date('2022-04-28T01:56:00.000Z'), 'testnet')).toBe(56741744)
  expect(estimateSlotByDate(new Date('2022-11-26T23:51:57Z'), 'preview')).toBe(2850717)
})

test('estimateDateBySlot', () => {
  expect(estimateDateBySlot(59013708, 'mainnet').toISOString()).toBe('2022-04-21T22:26:39.000Z')
  expect(estimateDateBySlot(56210868, 'testnet').toISOString()).toBe('2022-04-21T22:28:04.000Z')
  expect(estimateDateBySlot(56741744, 'testnet').toISOString()).toBe('2022-04-28T01:56:00.000Z')
  expect(estimateDateBySlot(2850717, 'preview').toISOString()).toBe('2022-11-26T23:51:57.000Z')
})

test('estimateDateBySlot', () => {
  expect(getEpochBySlot(59013708, 'mainnet')).toBe(334)
  expect(getEpochBySlot(59016575, 'mainnet')).toBe(334)
  expect(getEpochBySlot(56210868, 'testnet')).toBe(200)
  expect(getEpochBySlot(56211570, 'testnet')).toBe(200)
  expect(getEpochBySlot(56213638, 'testnet')).toBe(200)
  expect(getEpochBySlot(2851702, 'preview')).toBe(33)
})

test('getSlotInEpochBySlot', () => {
  expect(getSlotInEpochBySlot(59016575, 'mainnet')).toBe(91775)
  expect(getSlotInEpochBySlot(56213638, 'testnet')).toBe(183238)
})

test('encryption', async () => {
  const plaintext = new Uint8Array(Buffer.from('lorem ipsum', 'utf-8'))
  const ciphertext = new Uint8Array(await encryptWithPassword(plaintext, 'abcd', 0))
  expect(ciphertext).not.toEqual(new Uint8Array(plaintext))
  expect(ciphertext).not.toEqual(new Uint8Array(await encryptWithPassword(plaintext, '1234', 0)))
  expect(ciphertext).not.toEqual(new Uint8Array(await encryptWithPassword(plaintext, 'abcd', 1)))
  expect(plaintext).toEqual(new Uint8Array(await decryptWithPassword(ciphertext, 'abcd', 0)))
})

test('parseDerivationPath', () => {
  expect(parseDerivationPath("m/1854'/1815'/0'/0/0")).toEqual([harden(1854), harden(1815), harden(0), 0, 0])
  expect(() => parseDerivationPath("1854'/1815'/0'/0/0")).toThrowError()
  expect(() => parseDerivationPath("1854'/1815'/a'/0/0")).toThrowError()
  expect(() => parseDerivationPath("1854'/1815''/0'/0/0")).toThrowError()
})

test('buildDerivationPath', () => {
  expect(formatDerivationPath([harden(1854), harden(1815), harden(0), 0, 0])).toEqual("m/1854'/1815'/0'/0/0")
})
