import Dexie, { Table } from 'dexie'

interface Treasury {
  name: string
  description: string
  script: string
  updatedAt: Date
}

class LocalDatabase extends Dexie {
  treasuries!: Table<Treasury>

  constructor() {
    super('roundTable')

    this.version(1).stores({
      treasuries: '&address'
    })

    this.version(2).stores({
      treasuries: null,
      treasuriesTemp: '&script'
    }).upgrade(async (transaction) => {
      const treasuries = await transaction.table('treasuries').toArray().then((oldTreasuries) =>
        oldTreasuries.map((treaury) => {
          return {
            name: treaury.title,
            description: treaury.description,
            script: Buffer.from(treaury.script).toString('base64'),
            updatedAt: treaury.updatedAt
          }
        })
      )
      await transaction.table('treasuriesTemp').bulkAdd(treasuries)
    })

    this.version(3).stores({
      treasuries: '&script',
      treasuriesTemp: null
    }).upgrade(async (transaction) => {
      const treasuries = await transaction.table('treasuriesTemp').toArray()
      await transaction.table('treasuries').bulkAdd(treasuries)
    })
  }
}

const db = new LocalDatabase()

export type { Treasury }
export { db }
