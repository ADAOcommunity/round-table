import Dexie, { Table } from 'dexie'

interface Treasury {
  address: string
  title: string
  description: string
  script: Uint8Array
  updatedAt: Date
}

class LocalDatabase extends Dexie {
  treasuries!: Table<Treasury>

  constructor() {
    super('localDatabase')

    this.version(1).stores({
      treasuries: '&address'
    })
  }
}

const db = new LocalDatabase()

export type { Treasury }
export { db }
