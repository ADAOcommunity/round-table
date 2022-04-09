import Dexie, { Table } from 'dexie'

interface Treasury {
  hash: string
  name: string
  description: string
  script: Uint8Array
  updatedAt: Date
}

class LocalDatabase extends Dexie {
  treasuries!: Table<Treasury>

  constructor() {
    super('round-table')

    this.version(1).stores({
      treasuries: '&hash'
    })
  }
}

const db = new LocalDatabase()

export type { Treasury }
export { db }
