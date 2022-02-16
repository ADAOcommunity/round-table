import type { Ed25519KeyHash } from '@emurgo/cardano-serialization-lib-browser'

type CardanoWASM = typeof import('@emurgo/cardano-serialization-lib-browser')

class Cardano {
  private _wasm: CardanoWASM

  public constructor(wasm: CardanoWASM) {
    this._wasm = wasm
  }

  public getBech32AddressKeyHash(bech32_address: string): Ed25519KeyHash {
    const { Address, BaseAddress } = this._wasm
    const address = Address.from_bech32(bech32_address)
    const keyHash = BaseAddress.from_address(address)?.payment_cred().to_keyhash()

    if (!keyHash) {
      throw new Error('failed to get keyhash from address')
    }

    return keyHash
  }
}

class Factory {
  private _instance?: Cardano

  public get instance() {
    return this._instance
  }

  public async load() {
    if (!this.instance)
      this._instance = new Cardano(await import('@emurgo/cardano-serialization-lib-browser'))
    return this.instance
  }
}

const CardanoSerializationLib = new Factory()

export type { Cardano }
export { CardanoSerializationLib }
