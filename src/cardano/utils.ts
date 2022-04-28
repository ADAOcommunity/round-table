const SlotLength = 432000
const shelleyStart = (isMainnet: boolean): number => isMainnet ? 4924800 : 4924800 + 129600 - SlotLength
const networkOffset = (isMainnet: boolean): number => isMainnet ? 1596491091 : 1599294016 + 129600 - SlotLength
const estimateDateBySlot = (slot: number, isMainnet: boolean): Date => new Date((slot - shelleyStart(isMainnet) + networkOffset(isMainnet)) * 1000)
const estimateSlotByDate = (date: Date, isMainnet: boolean): number => Math.floor(date.getTime() / 1000) + shelleyStart(isMainnet) - networkOffset(isMainnet)
const slotSinceShelley = (slot: number, isMainnet: boolean): number => slot - shelleyStart(isMainnet)
const getEpochBySlot = (slot: number, isMainnet: boolean) => Math.floor(slotSinceShelley(slot, isMainnet) / SlotLength) + (isMainnet ? 208 : 80) + 1
const getSlotInEpochBySlot = (slot: number, isMainnet: boolean) => slotSinceShelley(slot, isMainnet) % SlotLength

export { estimateDateBySlot, estimateSlotByDate, getEpochBySlot, getSlotInEpochBySlot, SlotLength }
