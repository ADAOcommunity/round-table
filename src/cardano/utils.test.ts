import { estimateDateBySlot, estimateSlotByDate, getEpochBySlot, getSlotInEpochBySlot } from "./utils"

test('estimateSlotByDate', () => {
  expect(estimateSlotByDate(new Date('2022-04-21T22:26:39.000Z'), 'mainnet')).toBe(59013708)
  expect(estimateSlotByDate(new Date('2022-04-21T22:28:04.000Z'), 'testnet')).toBe(56210868)
  expect(estimateSlotByDate(new Date('2022-04-28T01:56:00.000Z'), 'testnet')).toBe(56741744)
})

test('estimateDateBySlot', () => {
  expect(estimateDateBySlot(59013708, 'mainnet').toISOString()).toBe('2022-04-21T22:26:39.000Z')
  expect(estimateDateBySlot(56210868, 'testnet').toISOString()).toBe('2022-04-21T22:28:04.000Z')
  expect(estimateDateBySlot(56741744, 'testnet').toISOString()).toBe('2022-04-28T01:56:00.000Z')
})

test('estimateDateBySlot', () => {
  expect(getEpochBySlot(59013708, 'mainnet')).toBe(334)
  expect(getEpochBySlot(59016575, 'mainnet')).toBe(334)
  expect(getEpochBySlot(56210868, 'testnet')).toBe(200)
  expect(getEpochBySlot(56211570, 'testnet')).toBe(200)
  expect(getEpochBySlot(56213638, 'testnet')).toBe(200)
})

test('getSlotInEpochBySlot', () => {
  expect(getSlotInEpochBySlot(59016575, 'mainnet')).toBe(91775)
  expect(getSlotInEpochBySlot(56213638, 'testnet')).toBe(183238)
})
