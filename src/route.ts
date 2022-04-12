import type { NativeScript, Transaction } from '@dcspark/cardano-multiplatform-lib-browser'
import { encodeCardanoData } from './cardano/multiplatform-lib'

function getTreasuriesPath(subPath?: string): string {
  return '/' + ['treasuries', subPath].join('/')
}

function getTreasuryPath(script: NativeScript, subPath?: string): string {
  const base64CBOR = encodeCardanoData(script, 'base64')
  return getTreasuriesPath([encodeURIComponent(base64CBOR), subPath].join('/'))
}

function getTransactionPath(transcation: Transaction): string {
  const base64CBOR = encodeCardanoData(transcation, 'base64')
  return ['/transactions', encodeURIComponent(base64CBOR)].join('/')
}

export { getTreasuriesPath, getTreasuryPath, getTransactionPath }
