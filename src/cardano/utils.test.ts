import { estimateDateBySlot, estimateSlotByDate, getEpochBySlot, getSlotInEpochBySlot } from "./utils"

test('estimateSlotByDate', () => {
  expect(estimateSlotByDate(new Date('2022-04-21T22:26:39.000Z'), true)).toBe(59013708)
  expect(estimateSlotByDate(new Date('2022-04-21T22:28:04.000Z'), false)).toBe(56210868)
})

test('estimateDateBySlot', () => {
  expect(estimateDateBySlot(59013708, true).toISOString()).toBe('2022-04-21T22:26:39.000Z')
  expect(estimateDateBySlot(56210868, false).toISOString()).toBe('2022-04-21T22:28:04.000Z')
})

test('estimateDateBySlot', () => {
  expect(getEpochBySlot(59013708, true)).toBe(334)
  expect(getEpochBySlot(59016575, true)).toBe(334)
  expect(getEpochBySlot(56210868, false)).toBe(200)
  expect(getEpochBySlot(56211570, false)).toBe(200)
  expect(getEpochBySlot(56213638, false)).toBe(200)
})

test('getSlotInEpochBySlot', () => {
  expect(getSlotInEpochBySlot(59016575, true)).toBe(91775)
  expect(getSlotInEpochBySlot(56213638, false)).toBe(183238)
})
