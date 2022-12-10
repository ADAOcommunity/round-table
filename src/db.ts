import Dexie, { Table } from 'dexie'

type Policy =
  | { type: 'All', policies: Array<Policy> }
  | { type: 'Any', policies: Array<Policy> }
  | { type: 'NofK', policies: Array<Policy>, number: number }
  | { type: 'TimelockStart', slot: number }
  | { type: 'TimelockExpiry', slot: number }
  | string

type BasicInfoParams = {
  name: string
  description: string
}

type MultisigWalletParams = BasicInfoParams & {
  policy: Policy
}

interface Timestamp {
  updatedAt: Date
}

type MultisigWallet = { id: string } & MultisigWalletParams & Timestamp

type PersonalAccount = {
  publicKey: Uint8Array
  paymentKeyHashes: Uint8Array[]
}

type MultisigAccount = {
  publicKey: Uint8Array
  addresses: {
    paymentKeyHash: Uint8Array
    stakingKeyHash: Uint8Array
  }[]
}

type PersonalWallet = BasicInfoParams & Timestamp & {
  id: number
  hash: Uint8Array
  rootKey: Uint8Array
  personalAccounts: Map<number, PersonalAccount>
  multisigAccounts: Map<number, MultisigAccount>
}

type KeyHashIndex = {
  hash: Uint8Array
  derivationPath: number[]
  walletId: number
}

class LocalDatabase extends Dexie {
  multisigWallets!: Table<MultisigWallet>
  personalWallets!: Table<PersonalWallet>
  keyHashIndices!: Table<KeyHashIndex>

  constructor() {
    super('round-table')

    this.version(1).stores({
      multisigWallets: '&id',
      personalWallets: '&id, &hash',
      keyHashIndices: '&hash, walletId'
    })
  }
}

const db = new LocalDatabase()

const createPersonalWallet = (wallet: PersonalWallet, indices: KeyHashIndex[]) => db.transaction('rw', db.personalWallets, db.keyHashIndices, async () => {
  return db.personalWallets.add(wallet).then(() => db.keyHashIndices.bulkPut(indices))
})
const updatePersonalWallet = (wallet: PersonalWallet, indices: KeyHashIndex[]) => db.transaction('rw', db.personalWallets, db.keyHashIndices, async () => {
  return db.personalWallets.put(wallet).then(() => db.keyHashIndices.bulkPut(indices))
})
const deletePersonalWallet = (wallet: PersonalWallet) => db.transaction('rw', db.personalWallets, db.keyHashIndices, async () => {
  const walletId = wallet.id
  return db.personalWallets.delete(walletId).then(() => db.keyHashIndices.where({ walletId }).delete())
})
const updatePersonalWalletAndDeindex = (wallet: PersonalWallet, keyHashes: Uint8Array[]) => db.transaction('rw', db.personalWallets, db.keyHashIndices, async () => {
  return db.personalWallets.put(wallet).then(() => db.keyHashIndices.where('hash').anyOf(keyHashes).delete())
})

export type { MultisigWallet, MultisigWalletParams, PersonalWallet, Policy, BasicInfoParams, PersonalAccount, MultisigAccount, KeyHashIndex }
export { db, createPersonalWallet, updatePersonalWallet, updatePersonalWalletAndDeindex, deletePersonalWallet }
