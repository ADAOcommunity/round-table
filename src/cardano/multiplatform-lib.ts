import type { ProtocolParams, TransactionOutput } from '@cardano-graphql/client-ts'
import type { Address, BaseAddress, BigNum, Ed25519KeyHash, NativeScript, NetworkInfo, ScriptHash, Transaction, TransactionBuilder, TransactionHash, TransactionOutput as CardanoTransactionOutput, TransactionUnspentOutputs, Value as CardanoValue, Vkeywitness } from '@dcspark/cardano-multiplatform-lib-browser'
import { nanoid } from 'nanoid'
import { useEffect, useState } from 'react'
import type { Config } from './config'
import type { Value } from './query-api'
import { getAssetName, getPolicyId } from './query-api'

type CardanoWASM = typeof import('@dcspark/cardano-multiplatform-lib-browser')
type MultiSigType = 'all' | 'any' | 'atLeast'
type Recipient = {
  id: string
  address: string
  value: Value
}

const newRecipient = (): Recipient => {
  return {
    id: nanoid(),
    address: '',
    value: {
      lovelace: BigInt(0),
      assets: new Map()
    }
  }
}

const isAddressNetworkCorrect = (config: Config, address: Address): boolean => {
  const networkId = address.network_id()
  return config.isMainnet ? networkId === 1 : networkId === 0
}

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

  public buildTxOutput(recipient: Recipient): Result<CardanoTransactionOutput> {
    const { Address, TransactionOutputBuilder } = this.lib
    return getResult(() => {
      const address = Address.from_bech32(recipient.address)
      const builder = TransactionOutputBuilder
        .new()
        .with_address(address)
        .next()
      const value = this.getCardanoValue(recipient.value)
      return builder.with_value(value).build()
    })
  }

  public getMinLovelace(value: Value, hasDataHash: boolean, coinsPerUtxoByte: number): bigint {
    const minimum = this.lib.min_ada_required(
      this.getCardanoValue(value),
      hasDataHash,
      this.lib.BigNum.from_str(coinsPerUtxoByte.toString())
    )
    return BigInt(minimum.to_str())
  }

  public getCardanoValue(value: Value): CardanoValue {
    const { AssetName, BigNum, MultiAsset, ScriptHash } = this.lib
    const { lovelace, assets } = value
    const cardanoValue = this.lib.Value.new(BigNum.from_str(lovelace.toString()))
    if (assets.size > 0) {
      const multiAsset = MultiAsset.new()
      assets.forEach((quantity, id, _) => {
        const policyId = ScriptHash.from_bytes(Buffer.from(getPolicyId(id), 'hex'))
        const assetName = AssetName.new(Buffer.from(getAssetName(id), 'hex'))
        const value = BigNum.from_str(quantity.toString())
        multiAsset.set_asset(policyId, assetName, value)
      })
      cardanoValue.set_multiasset(multiAsset)
    }
    return cardanoValue
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

  public buildSignatureSetHex(vkeys: Vkeywitness[]): string {
    const { TransactionWitnessSet, Vkeywitnesses } = this.lib
    const witnessSet = TransactionWitnessSet.new()
    const vkeySet = Vkeywitnesses.new()
    vkeys.forEach((vkey) => vkeySet.add(vkey))
    witnessSet.set_vkeys(vkeySet)
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
      const keyHash = address.as_base()?.payment_cred().to_keyhash()
      if (!keyHash) throw new Error('failed to get keyhash from address')
      return keyHash
    })
  }

  public getAddressScriptHash(address: Address): Result<ScriptHash> {
    return getResult(() => {
      const scriptHash = address.as_base()?.payment_cred().to_scripthash()
      if (!scriptHash) throw new Error('failed to get script hash from address')
      return scriptHash
    })
  }

  public createTxBuilder(protocolParameters: ProtocolParams): TransactionBuilder {
    const { BigNum, TransactionBuilder, TransactionBuilderConfigBuilder, LinearFee } = this.lib
    const { minFeeA, minFeeB, poolDeposit, keyDeposit,
      coinsPerUtxoByte, maxTxSize, maxValSize } = protocolParameters

    if (!coinsPerUtxoByte) throw new Error('No coinsPerUtxoByte')
    if (!maxValSize) throw new Error('No maxValSize')

    const toBigNum = (value: number) => BigNum.from_str(value.toString())
    const config = TransactionBuilderConfigBuilder.new()
      .fee_algo(LinearFee.new(toBigNum(minFeeA), toBigNum(minFeeB)))
      .pool_deposit(toBigNum(poolDeposit))
      .key_deposit(toBigNum(keyDeposit))
      .coins_per_utxo_word(toBigNum(coinsPerUtxoByte))
      .max_tx_size(maxTxSize)
      .max_value_size(parseFloat(maxValSize))
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

  public buildUTxOSet(utxos: TransactionOutput[]): TransactionUnspentOutputs {
    const { Address, AssetName, BigNum, MultiAsset, ScriptHash,
      TransactionInput, TransactionHash, TransactionOutput,
      TransactionUnspentOutput, TransactionUnspentOutputs } = this.lib

    const utxosSet = TransactionUnspentOutputs.new()
    utxos.forEach((utxo) => {
      const value = this.lib.Value.new(BigNum.from_str(utxo.value.toString()))
      const address = Address.from_bech32(utxo.address)
      if (utxo.tokens.length > 0) {
        const multiAsset = MultiAsset.new()
        utxo.tokens.forEach((token) => {
          const { assetId } = token.asset
          const policyId = ScriptHash.from_bytes(Buffer.from(getPolicyId(assetId), 'hex'))
          const assetName = AssetName.new(Buffer.from(getAssetName(assetId), 'hex'))
          const quantity = BigNum.from_str(token.quantity.toString())
          multiAsset.set_asset(policyId, assetName, quantity)
        })
        value.set_multiasset(multiAsset)
      }
      const txUnspentOutput = TransactionUnspentOutput.new(
        TransactionInput.new(TransactionHash.from_bytes(Buffer.from(utxo.txHash, 'hex')), BigNum.from_str(utxo.index.toString())),
        TransactionOutput.new(address, value)
      )
      utxosSet.add(txUnspentOutput)
    })

    return utxosSet
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
      this._instance = new Cardano(await import('@dcspark/cardano-multiplatform-lib-browser'))
    return this.instance
  }
}

const Loader = new Factory()

const useCardanoMultiplatformLib = () => {
  const [cardano, setCardano] = useState<Cardano | undefined>(undefined)

  useEffect(() => {
    let isMounted = true

    Loader.load().then((instance) => {
      isMounted && setCardano(instance)
    })

    return () => {
      isMounted = false
    }
  }, [])

  return cardano
}

export type { Cardano, CardanoIterable, Result, MultiSigType, Recipient }
export { encodeCardanoData, getResult, toIter, toHex, useCardanoMultiplatformLib, verifySignature, Loader, newRecipient, isAddressNetworkCorrect }
