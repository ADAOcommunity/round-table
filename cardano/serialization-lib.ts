import type { BaseAddress, Ed25519KeyHash, NativeScript, NativeScripts, NetworkInfo, ScriptHash, TransactionBuilder } from '@emurgo/cardano-serialization-lib-browser'
import { Buffer } from 'buffer'
import { useEffect, useState } from 'react'
import { ProtocolParameters } from './query-api'

type CardanoWASM = typeof import('@emurgo/cardano-serialization-lib-browser')
type MultiSigType = 'all' | 'any' | 'atLeast'

const toHex = (input: ArrayBuffer) => Buffer.from(input).toString("hex")

class Cardano {
  private _wasm: CardanoWASM

  public constructor(wasm: CardanoWASM) {
    this._wasm = wasm
  }

  public get lib() {
    return this._wasm
  }

  public getKeyHashHex(address: string): string {
    const bytes = this.getAddressKeyHash(address).to_bytes()
    return toHex(bytes)
  }

  public getMultiSigScriptAddress(addresses: Set<string>, type: MultiSigType, required: number, isMainnet: boolean): string {
    const publicKeyScripts = Array.from(addresses, (address) => {
      const keyHash = this.getAddressKeyHash(address)
      return this.buildPublicKeyScript(keyHash)
    })

    const buildScript = (): NativeScript => {
      switch (type) {
        case 'all': return this.buildAllScript(publicKeyScripts)
        case 'any': return this.buildAnyScript(publicKeyScripts)
        case 'atLeast': return this.buildAtLeastScript(publicKeyScripts, required)
      }
    }

    const { NetworkInfo } = this.lib
    const networkInfo = isMainnet ? NetworkInfo.mainnet() : NetworkInfo.testnet()

    return this.getScriptAddress(buildScript(), networkInfo)
  }

  public createTxBuilder(protocolParameters: ProtocolParameters): TransactionBuilder {
    const { BigNum, TransactionBuilder, TransactionBuilderConfigBuilder, LinearFee } = this.lib
    const { minFeeA, minFeeB, poolDeposit, keyDeposit,
            coinsPerUtxoWord, maxTxSize, maxValSize } = protocolParameters
    const toBigNum = (value: number) => BigNum.from_str(value.toString())
    const config = TransactionBuilderConfigBuilder.new()
      .fee_algo(LinearFee.new(toBigNum(minFeeA), toBigNum(minFeeB)))
      .pool_deposit(toBigNum(poolDeposit))
      .key_deposit(toBigNum(keyDeposit))
      .coins_per_utxo_word(toBigNum(coinsPerUtxoWord))
      .max_tx_size(maxTxSize)
      .max_value_size(maxValSize)
      .build()
    return TransactionBuilder.new(config)
  }

  private getAddressKeyHash(bech32Address: string): Ed25519KeyHash {
    const { Address, BaseAddress } = this.lib
    const address = Address.from_bech32(bech32Address)
    const keyHash = BaseAddress.from_address(address)?.payment_cred().to_keyhash()

    if (!keyHash) {
      throw new Error('failed to get keyhash from address')
    }

    return keyHash
  }

  private buildPublicKeyScript(keyHash: Ed25519KeyHash): NativeScript {
    const { ScriptPubkey, NativeScript } = this.lib
    return NativeScript.new_script_pubkey(ScriptPubkey.new(keyHash))
  }

  private buildAllScript(scripts: NativeScript[]): NativeScript {
    const { ScriptAll, NativeScript } = this.lib
    return NativeScript.new_script_all(ScriptAll.new(this.buildNativeScripts(scripts)))
  }

  private buildAnyScript(scripts: NativeScript[]): NativeScript {
    const { ScriptAny, NativeScript } = this.lib
    return NativeScript.new_script_any(ScriptAny.new(this.buildNativeScripts(scripts)))
  }

  private buildAtLeastScript(scripts: NativeScript[], required: number): NativeScript {
    const { ScriptNOfK, NativeScript } = this.lib
    return NativeScript.new_script_n_of_k(ScriptNOfK.new(required, this.buildNativeScripts(scripts)))
  }

  private buildNativeScripts(scripts: NativeScript[]): NativeScripts {
    const { NativeScripts } = this.lib
    const nativeScripts = NativeScripts.new()
    scripts.forEach((script) => {
      nativeScripts.add(script)
    })
    return nativeScripts
  }

  private getScriptHash(script: NativeScript): ScriptHash {
    const { ScriptHashNamespace } = this.lib
    return script.hash(ScriptHashNamespace.NativeScript)
  }

  private getScriptHashBaseAddress(scriptHash: ScriptHash, networkInfo: NetworkInfo): BaseAddress {
    const { BaseAddress, StakeCredential } = this.lib
    const networkId = networkInfo.network_id()
    const credential = StakeCredential.from_scripthash(scriptHash)
    return BaseAddress.new(networkId, credential, credential)
  }

  private getScriptAddress(script: NativeScript, networkInfo: NetworkInfo): string {
    const scriptHash = this.getScriptHash(script)
    return this.getScriptHashBaseAddress(scriptHash, networkInfo).to_address().to_bech32()
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

const useCardanoSerializationLib = () => {
  const [cardano, setCardano] = useState<Cardano | undefined>(undefined)

  useEffect(() => {
    let isMounted = true

    CardanoSerializationLib.load().then((instance) => {
      isMounted && setCardano(instance)
    })

    return () => {
      isMounted = false
    }
  }, [])

  return cardano
}

export type { Cardano, MultiSigType }
export { useCardanoSerializationLib }
