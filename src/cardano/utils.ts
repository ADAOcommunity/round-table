import type { Network } from "./config"

const slotLength = (network: Network): number => {
  switch (network) {
    case 'mainnet': return 432000
    case 'testnet': return 432000
  }
}

const shelleyStart = (network: Network): number => {
  switch (network) {
    case 'mainnet': return 4924800
    case 'testnet': return 4924800 + 129600 - slotLength(network)
  }
}

const networkOffset = (network: Network): number => {
  switch (network) {
    case 'mainnet': return 1596491091
    case 'testnet': return 1599294016 + 129600 - slotLength(network)
  }
}

const estimateDateBySlot = (slot: number, network: Network): Date => new Date((slot - shelleyStart(network) + networkOffset(network)) * 1000)
const estimateSlotByDate = (date: Date, network: Network): number => Math.floor(date.getTime() / 1000) + shelleyStart(network) - networkOffset(network)
const slotSinceShelley = (slot: number, network: Network): number => slot - shelleyStart(network)

const epochBeforeShelly = (network: Network): number => {
  switch(network) {
    case 'mainnet': return 208
    case 'testnet': return 80
  }
}

const getEpochBySlot = (slot: number, network: Network) => Math.floor(slotSinceShelley(slot, network) / slotLength(network)) + 1 + epochBeforeShelly(network)
const getSlotInEpochBySlot = (slot: number, network: Network) => slotSinceShelley(slot, network) % slotLength(network)

export { estimateDateBySlot, estimateSlotByDate, getEpochBySlot, getSlotInEpochBySlot, slotLength }
