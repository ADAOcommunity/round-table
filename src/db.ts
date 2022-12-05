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
  keyHashMap: Map<string, number[]>
  personalAccounts: PersonalAccount[]
  multisigAccounts: MultisigAccount[]
}

class LocalDatabase extends Dexie {
  multisigWallets!: Table<MultisigWallet>
  personalWallets!: Table<PersonalWallet>

  constructor() {
    super('round-table')

    this.version(1).stores({
      multisigWallets: '&id',
      personalWallets: '&id, &hash'
    })
  }
}

const db = new LocalDatabase()

export type { MultisigWallet, MultisigWalletParams, PersonalWallet, Policy, BasicInfoParams, PersonalAccount, MultisigAccount }
export { db }
