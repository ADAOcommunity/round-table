import type { Transaction } from '@dcspark/cardano-multiplatform-lib-browser'
import { encodeCardanoData } from './cardano/multiplatform-lib'
import type { Policy } from './db'

function getMultisigWalletsPath(subPath?: string): string {
  return '/' + ['multisig', subPath].join('/')
}

function getMultisigWalletPath(policy: Policy, subPath?: string): string {
  return getMultisigWalletsPath([encodeURIComponent(JSON.stringify(policy)), subPath].join('/'))
}

function getPersonalWalletPath(id: number): string {
  return `/personal/${id}`
}

function getTransactionPath(transcation: Transaction): string {
  const base64CBOR = encodeCardanoData(transcation, 'base64')
  return ['/base64', encodeURIComponent(base64CBOR)].join('/')
}

export { getMultisigWalletsPath, getMultisigWalletPath, getTransactionPath, getPersonalWalletPath }
