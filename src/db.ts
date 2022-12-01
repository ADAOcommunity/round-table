import Dexie, { Table } from 'dexie'

type Policy =
  | { type: 'All', policies: Array<Policy> }
  | { type: 'Any', policies: Array<Policy> }
  | { type: 'NofK', policies: Array<Policy>, number: number }
  | { type: 'TimelockStart', slot: number }
  | { type: 'TimelockExpiry', slot: number }
  | string

type MultisigWalletParams = {
  name: string
  description: string
  policy: Policy
}

interface Timestamp {
  updatedAt: Date
}

type MultisigWallet = { id: string } & MultisigWalletParams & Timestamp

class LocalDatabase extends Dexie {
  multisigWallets!: Table<MultisigWallet>

  constructor() {
    super('round-table')

    this.version(1).stores({
      multisigWallets: '&id'
    })
  }
}

const db = new LocalDatabase()

export type { MultisigWallet, MultisigWalletParams, Policy }
export { db }
