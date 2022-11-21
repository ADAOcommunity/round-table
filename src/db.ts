import Dexie, { Table } from 'dexie'

type Policy =
  | { type: 'All', policies: Array<Policy> }
  | { type: 'Any', policies: Array<Policy> }
  | { type: 'NofK', policies: Array<Policy>, number: number }
  | { type: 'TimelockStart', slot: number }
  | { type: 'TimelockExpiry', slot: number }
  | string

type AccountParams = {
  name: string
  description: string
  policy: Policy
}

interface Timestamp {
  updatedAt: Date
}

type Account = { id: string } & AccountParams & Timestamp

class LocalDatabase extends Dexie {
  accounts!: Table<Account>

  constructor() {
    super('round-table')

    this.version(1).stores({
      accounts: '&id'
    })
  }
}

const db = new LocalDatabase()

export type { Account, AccountParams, Policy }
export { db }
