import Dexie, { Table } from 'dexie'
import { Loader } from './cardano/multiplatform-lib'

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

    this.version(4).stores({
      treasuries: null,
      treasuriesTemp: '&hash'
    }).upgrade(async (transaction) => {
      const cardano = await Loader.load()
      if (!cardano) throw new Error('Cannot load CML')
      const treasuries = await transaction.table('treasuries').toArray().then((oldTreasuries) =>
        oldTreasuries.map((treaury) => {
          const script = Buffer.from(treaury.script, 'base64')
          const nativeScript = cardano.lib.NativeScript.from_bytes(script)
          const scriptHash = cardano.hashScript(nativeScript)
          return {
            ...treaury,
            hash: scriptHash.to_hex(),
            script
          }
        })
      )
      await transaction.table('treasuriesTemp').bulkAdd(treasuries)
    })

    this.version(5).stores({
      treasuries: '&hash',
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
