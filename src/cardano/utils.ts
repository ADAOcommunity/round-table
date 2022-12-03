import type { Network } from './config'

const slotLength = (network: Network): number => {
  switch (network) {
    case 'mainnet': return 432000
    case 'testnet': return 432000
    case 'preview': return 86400
  }
}

const shelleyStart = (network: Network): number => {
  switch (network) {
    case 'mainnet': return 4924800
    case 'testnet': return 4924800 + 129600 - slotLength(network)
    case 'preview': return 0
  }
}

const networkOffset = (network: Network): number => {
  switch (network) {
    case 'mainnet': return 1596491091
    case 'testnet': return 1599294016 + 129600 - slotLength(network)
    case 'preview': return 1666656000
  }
}

const estimateDateBySlot = (slot: number, network: Network): Date => new Date((slot - shelleyStart(network) + networkOffset(network)) * 1000)
const estimateSlotByDate = (date: Date, network: Network): number => Math.floor(date.getTime() / 1000) + shelleyStart(network) - networkOffset(network)
const slotSinceShelley = (slot: number, network: Network): number => slot - shelleyStart(network)

const epochBeforeShelly = (network: Network): number => {
  switch (network) {
    case 'mainnet': return 208 + 1
    case 'testnet': return 80 + 1
    case 'preview': return 0
  }
}

const getEpochBySlot = (slot: number, network: Network) => Math.floor(slotSinceShelley(slot, network) / slotLength(network)) + epochBeforeShelly(network)
const getSlotInEpochBySlot = (slot: number, network: Network) => slotSinceShelley(slot, network) % slotLength(network)

const deriveKeyFromPassword = async (password: string, salt: ArrayBuffer): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    Buffer.from(password, 'utf-8'),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  ).then((material) =>
    crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      material,
      { 'name': 'AES-GCM', 'length': 256 },
      true,
      ['encrypt', 'decrypt']
    )
  )


const MAX_IV_NUM = 2 ** 32 - 1

const getIvFromNumber = (num: number): ArrayBuffer => {
  if (num > MAX_IV_NUM) throw new Error(`IV number overflow: ${num}`)
  const array = new Uint32Array(4)
  array[3] = num
  return array
}

const encryptWithPassword = async (plaintext: ArrayBuffer, password: string, id: number): Promise<ArrayBuffer> => {
  const iv = getIvFromNumber(id)
  const salt = await SHA256Digest(iv)
  return deriveKeyFromPassword(password, salt)
    .then((key) => {
      return crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        plaintext,
      )
    })
}

const decryptWithPassword = async (ciphertext: ArrayBuffer, password: string, id: number): Promise<ArrayBuffer> => {
  const iv = getIvFromNumber(id)
  const salt = await SHA256Digest(iv)
  return deriveKeyFromPassword(password, salt)
    .then((key) => crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext))
}

const SHA256Digest = async (data: ArrayBuffer): Promise<ArrayBuffer> => crypto.subtle.digest('SHA-256', data)

export { estimateDateBySlot, estimateSlotByDate, getEpochBySlot, getSlotInEpochBySlot, slotLength, encryptWithPassword, decryptWithPassword, SHA256Digest }
