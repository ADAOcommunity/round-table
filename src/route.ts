import { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { encodeCardanoData } from './cardano/serialization-lib'

function getTreasuriesPath(subPath?: string): string {
  return '/' + ['treasuries', subPath].join('/')
}

function getTreasuryPath(script: NativeScript, subPath?: string): string {
  const base64CBOR = encodeCardanoData(script, 'base64')
  return getTreasuriesPath([encodeURIComponent(base64CBOR), subPath].join('/'))
}

export { getTreasuriesPath, getTreasuryPath }
