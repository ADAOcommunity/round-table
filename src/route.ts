import type { Transaction } from '@dcspark/cardano-multiplatform-lib-browser'
import { encodeCardanoData } from './cardano/multiplatform-lib'
import type { Policy } from './db'

function getAccountsPath(subPath?: string): string {
  return '/' + ['accounts', subPath].join('/')
}

function getAccountPath(policy: Policy, subPath?: string): string {
  return getAccountsPath([encodeURIComponent(JSON.stringify(policy)), subPath].join('/'))
}

function getTransactionPath(transcation: Transaction): string {
  const base64CBOR = encodeCardanoData(transcation, 'base64')
  return ['/base64', encodeURIComponent(base64CBOR)].join('/')
}

export { getAccountsPath, getAccountPath, getTransactionPath }
