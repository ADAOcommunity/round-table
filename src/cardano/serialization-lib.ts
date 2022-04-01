import type { Address, BaseAddress, BigNum, Ed25519KeyHash, NativeScript, NativeScripts, NetworkInfo, ScriptHash, Transaction, TransactionBuilder, TransactionHash, TransactionUnspentOutputs, Vkeywitness } from '@adaocommunity/cardano-serialization-lib-browser'
import { useEffect, useState } from 'react'
import { ProtocolParameters } from './query-api'

type CardanoWASM = typeof import('@adaocommunity/cardano-serialization-lib-browser')
type MultiSigType = 'all' | 'any' | 'atLeast'

type Result<T> =
  | { isOk: true, data: T }
  | { isOk: false, message: string }

function getResult<T>(callback: () => T): Result<T> {
  try {
    return {
      isOk: true,
      data: callback()
    }
  } catch (error) {
    return {
      isOk: false,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

interface CardanoIterable<T> {
  len: () => number
  get: (index: number) => T
}

function toIter<T>(set: CardanoIterable<T>): IterableIterator<T> {
  let index = 0
  return {
    next: () => {
      return index < set.len() ? {
        done: false,
        value: set.get(index++)
      } : { done: true, value: null }
    },
    [Symbol.iterator]: function() { return this }
  }
}

interface ToBytes {
  to_bytes: () => Uint8Array
}

function encodeCardanoData(data: ToBytes | Uint8Array, encoding: BufferEncoding): string {
  const getBuffer = () => {
    if ('to_bytes' in data) {
      return Buffer.from(data.to_bytes())
    }
    return Buffer.from(data)
  }
  return getBuffer().toString(encoding)
}

function toHex(data: ToBytes | Uint8Array): string {
  return encodeCardanoData(data, 'hex')
}

function verifySignature(txHash: TransactionHash, vkeywitness: Vkeywitness): boolean {
  const publicKey = vkeywitness.vkey().public_key()
  const signature = vkeywitness.signature()
  return publicKey.verify(txHash.to_bytes(), signature)
}

class Cardano {
  private _wasm: CardanoWASM

  public constructor(wasm: CardanoWASM) {
    this._wasm = wasm
  }

  public get lib() {
    return this._wasm
  }

  public getMessageLabel(): BigNum {
    return this.lib.BigNum.from_str('674')
  }

  public getTxMessage(transaction: Transaction): string[] | undefined {
    const label = this.getMessageLabel()
    const metadatum = transaction.auxiliary_data()?.metadata()?.get(label)?.as_map().get_str('msg').as_list()
    return metadatum && Array.from(toIter(metadatum), (metadata) => metadata.as_text())
  }

  public signTransaction(transaction: Transaction, vkeyIter: IterableIterator<Vkeywitness>): Transaction {
    const { Transaction, Vkeywitnesses } = this.lib
    const witnessSet = transaction.witness_set()
    const vkeyWitnessSet = Vkeywitnesses.new()
    Array.from(vkeyIter, (vkey) => vkeyWitnessSet.add(vkey))
    witnessSet.set_vkeys(vkeyWitnessSet)
    return Transaction.new(transaction.body(), witnessSet, transaction.auxiliary_data())
  }

  public buildSingleSignatureHex(vkey: Vkeywitness): string {
    const { TransactionWitnessSet, Vkeywitnesses } = this.lib
    const witnessSet = TransactionWitnessSet.new()
    const vkeys = Vkeywitnesses.new()
    vkeys.add(vkey)
    witnessSet.set_vkeys(vkeys)
    return toHex(witnessSet)
  }

  public parseAddress(bech32Address: string): Result<Address> {
    return getResult(() => this.lib.Address.from_bech32(bech32Address))
  }

  public chainCoinSelection(builder: TransactionBuilder, UTxOSet: TransactionUnspentOutputs, address: Address): void {
    const Strategy = this.lib.CoinSelectionStrategyCIP2
    try {
      builder.add_inputs_from(UTxOSet, Strategy.RandomImprove)
      builder.add_change_if_needed(address)
    } catch {
      try {
        builder.add_inputs_from(UTxOSet, Strategy.LargestFirst)
        builder.add_change_if_needed(address)
      } catch {
        try {
          builder.add_inputs_from(UTxOSet, Strategy.RandomImproveMultiAsset)
          builder.add_change_if_needed(address)
        } catch {
          builder.add_inputs_from(UTxOSet, Strategy.LargestFirstMultiAsset)
          builder.add_change_if_needed(address)
        }
      }
    }
  }

  public getAddressKeyHash(address: Address): Result<Ed25519KeyHash> {
    return getResult(() => {
      const keyHash = this.lib.BaseAddress.from_address(address)?.payment_cred().to_keyhash()
      if (!keyHash) throw new Error('failed to get keyhash from address')
      return keyHash
    })
  }

  public getAddressScriptHash(address: Address): Result<ScriptHash> {
    return getResult(() => {
      const scriptHash = this.lib.BaseAddress.from_address(address)?.payment_cred().to_scripthash()
      if (!scriptHash) throw new Error('failed to get script hash from address')
      return scriptHash
    })
  }

  public buildMultiSigScript(keyHashes: Ed25519KeyHash[], type: MultiSigType, required: number): NativeScript {
    const publicKeyScripts = keyHashes.map((keyHash) => this.buildPublicKeyScript(keyHash))

    switch (type) {
      case 'all': return this.buildAllScript(publicKeyScripts)
      case 'any': return this.buildAnyScript(publicKeyScripts)
      case 'atLeast': return this.buildAtLeastScript(publicKeyScripts, required)
    }
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

  public hashScript(script: NativeScript): ScriptHash {
    const { ScriptHashNamespace } = this.lib
    return script.hash(ScriptHashNamespace.NativeScript)
  }

  public getScriptAddress(script: NativeScript, isMainnet: boolean): Address {
    const { NetworkInfo } = this.lib
    const scriptHash = this.hashScript(script)
    const networkInfo = isMainnet ? NetworkInfo.mainnet() : NetworkInfo.testnet()
    return this.getScriptHashBaseAddress(scriptHash, networkInfo).to_address()
  }

  public getScriptType(script: NativeScript): MultiSigType {
    const { NativeScriptKind } = this.lib
    switch (script.kind()) {
      case NativeScriptKind.ScriptAll: return 'all'
      case NativeScriptKind.ScriptAny: return 'any'
      case NativeScriptKind.ScriptNOfK: return 'atLeast'
      default: throw new Error(`Unsupported Script Type: ${script.kind()}`)
    }
  }

  public getRequiredSignatures(script: NativeScript): number {
    const totalNumber = script.get_required_signers().len()
    switch (this.getScriptType(script)) {
      case 'all': return totalNumber
      case 'any': return 1
      case `atLeast`:
        const nofK = script.as_script_n_of_k()
        if (!nofK) throw new Error('cannot convert to ScriptNofK')
        return nofK.n()
    }
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

  private getScriptHashBaseAddress(scriptHash: ScriptHash, networkInfo: NetworkInfo): BaseAddress {
    const { BaseAddress, StakeCredential } = this.lib
    const networkId = networkInfo.network_id()
    const credential = StakeCredential.from_scripthash(scriptHash)
    return BaseAddress.new(networkId, credential, credential)
  }
}

class Factory {
  private _instance?: Cardano

  public get instance() {
    return this._instance
  }

  public async load() {
    if (!this.instance)
      this._instance = new Cardano(await import('@adaocommunity/cardano-serialization-lib-browser'))
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

export type { Cardano, CardanoIterable, Result, MultiSigType }
export { encodeCardanoData, getResult, toIter, toHex, useCardanoSerializationLib, verifySignature }