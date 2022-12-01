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

type PersonalWalletParams = BasicInfoParams & {
  id: number
  key: Uint8Array
}

interface Timestamp {
  updatedAt: Date
}

type MultisigWallet = { id: string } & MultisigWalletParams & Timestamp
type PersonalWallet = PersonalWalletParams & Timestamp

class LocalDatabase extends Dexie {
  multisigWallets!: Table<MultisigWallet>
  personalWallets!: Table<PersonalWallet>

  constructor() {
    super('round-table')

    this.version(1).stores({
      multisigWallets: '&id',
      personalWallets: '&id'
    })
  }
}

const db = new LocalDatabase()

export type { MultisigWallet, MultisigWalletParams, PersonalWallet, PersonalWalletParams, Policy }
export { db }
