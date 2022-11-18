import Dexie, { Table } from 'dexie'

type Policy =
  | { type: 'All', policies: Array<Policy> }
  | { type: 'Any', policies: Array<Policy> }
  | { type: 'NofK', policies: Array<Policy>, number: number }
  | { type: 'TimelockStart', slot: number }
  | { type: 'TimelockExpiry', slot: number }
  | string

interface Account {
  id: string
  name: string
  description: string
  policy: Policy
  updatedAt: Date
}

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

export type { Account, Policy }
export { db }
