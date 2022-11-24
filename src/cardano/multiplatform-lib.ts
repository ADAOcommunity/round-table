import type { ProtocolParams, TransactionOutput } from '@cardano-graphql/client-ts/api'
import type { Address, BigNum, Ed25519KeyHash, NativeScript, RewardAddress, SingleInputBuilder, SingleOutputBuilderResult, Transaction, TransactionBuilder, TransactionHash, Value as CMLValue, Vkeywitness } from '@dcspark/cardano-multiplatform-lib-browser'
import { nanoid } from 'nanoid'
import { useEffect, useState } from 'react'
import type { Policy } from '../db'
import type { Config } from './config'
import type { Value } from './query-api'
import { getAssetName, getPolicyId } from './query-api'

const Fraction = require('fractional').Fraction
type Fraction = { numerator: number, denominator: number }

type CardanoWASM = typeof import('@dcspark/cardano-multiplatform-lib-browser')
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

const toAddressString = (address: Address): string => address.as_byron()?.to_base58() ?? address.to_bech32()

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
    [Symbol.iterator]: function () { return this }
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

  public buildTxOutput(recipient: Recipient, protocolParams: ProtocolParams): SingleOutputBuilderResult {
    if (recipient.value.lovelace < this.getMinLovelace(recipient, protocolParams)) {
      const error = new Error('Insufficient ADA')
      error.name = 'InsufficientADAError'
      throw error
    }
    const { TransactionOutputBuilder } = this.lib
    return TransactionOutputBuilder
      .new()
      .with_address(this.parseAddress(recipient.address))
      .next()
      .with_value(this.buildCMLValue(recipient.value))
      .build()
  }

  public getMinLovelace(recipient: Recipient, protocolParams: ProtocolParams): bigint {
    const { BigNum, TransactionOutput } = this.lib
    if (!protocolParams.coinsPerUtxoByte) throw new Error('coinsPerUtxoByte is missing')
    const coinsPerUtxoByte = BigNum.from_str(protocolParams.coinsPerUtxoByte.toString())
    const address = this.parseAddress(recipient.address)
    const txOutput = TransactionOutput.new(address, this.buildCMLValue(recipient.value))
    const minimum = this.lib.min_ada_required(
      txOutput,
      coinsPerUtxoByte
    )
    return BigInt(minimum.to_str())
  }

  public buildCMLValue(value: Value): CMLValue {
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

  public createTxInputBuilder(input: TransactionOutput): SingleInputBuilder {
    const { AssetName, BigNum, MultiAsset, ScriptHash, SingleInputBuilder, TransactionHash, TransactionInput, } = this.lib
    const hash = TransactionHash.from_hex(input.txHash)
    const index = BigNum.from_str(input.index.toString())
    const txInput = TransactionInput.new(hash, index)
    const value = this.lib.Value.new(BigNum.from_str(input.value))
    if (input.tokens.length > 0) {
      const multiAsset = MultiAsset.new()
      input.tokens.forEach((token) => {
        const assetId = token.asset.assetId
        const policyId = ScriptHash.from_bytes(Buffer.from(getPolicyId(assetId), 'hex'))
        const assetName = AssetName.new(Buffer.from(getAssetName(assetId), 'hex'))
        const quantity = BigNum.from_str(token.quantity.toString())
        multiAsset.set_asset(policyId, assetName, quantity)
      })
      value.set_multiasset(multiAsset)
    }
    const txOuput = this.lib.TransactionOutput.new(this.parseAddress(input.address), value)
    return SingleInputBuilder.new(txInput, txOuput)
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

  public parseAddress(address: string): Address {
    const { Address, ByronAddress } = this.lib
    if (Address.is_valid_bech32(address)) return Address.from_bech32(address)
    if (Address.is_valid_byron(address)) return ByronAddress.from_base58(address).to_address()
    const error = new Error('The address is invalid.')
    error.name = 'InvalidAddressError'
    throw error
  }

  public isValidAddress(address: string): boolean {
    const { Address } = this.lib
    return Address.is_valid(address)
  }

  public createTxBuilder(protocolParameters: ProtocolParams): TransactionBuilder {
    const { BigNum, ExUnitPrices, UnitInterval, TransactionBuilder, TransactionBuilderConfigBuilder, LinearFee } = this.lib
    const { minFeeA, minFeeB, poolDeposit, keyDeposit,
      coinsPerUtxoByte, maxTxSize, maxValSize, maxCollateralInputs,
      priceMem, priceStep, collateralPercent } = protocolParameters

    if (!coinsPerUtxoByte) throw new Error('coinsPerUtxoByte is missing')
    if (!maxValSize) throw new Error('maxValSize is missing')
    if (!priceMem) throw new Error('priceMem is missing')
    if (!priceStep) throw new Error('priceStep is missing')
    if (!collateralPercent) throw new Error('collateralPercent is missing')
    if (!maxCollateralInputs) throw new Error('maxCollateralInputs is missing')

    const toBigNum = (value: number) => BigNum.from_str(value.toString())
    const priceMemFraction: Fraction = new Fraction(priceMem)
    const priceStepFraction: Fraction = new Fraction(priceStep)
    const exUnitPrices = ExUnitPrices.new(
      UnitInterval.new(toBigNum(priceMemFraction.numerator), toBigNum(priceMemFraction.denominator)),
      UnitInterval.new(toBigNum(priceStepFraction.numerator), toBigNum(priceStepFraction.denominator))
    )
    const config = TransactionBuilderConfigBuilder.new()
      .fee_algo(LinearFee.new(toBigNum(minFeeA), toBigNum(minFeeB)))
      .pool_deposit(toBigNum(poolDeposit))
      .key_deposit(toBigNum(keyDeposit))
      .coins_per_utxo_byte(toBigNum(coinsPerUtxoByte))
      .max_tx_size(maxTxSize)
      .max_value_size(parseFloat(maxValSize))
      .ex_unit_prices(exUnitPrices)
      .collateral_percentage(collateralPercent)
      .max_collateral_inputs(maxCollateralInputs)
      .build()
    return TransactionBuilder.new(config)
  }

  public getNativeScriptFromPolicy(policy: Policy, getKeyHash: (address: Address) => Ed25519KeyHash): NativeScript {
    const { Address, BigNum, NativeScript, NativeScripts, ScriptAll, ScriptAny, ScriptNOfK, ScriptPubkey, TimelockStart, TimelockExpiry } = this.lib
    if (typeof policy === 'string') {
      const keyHash = getKeyHash(Address.from_bech32(policy))
      return NativeScript.new_script_pubkey(ScriptPubkey.new(keyHash))
    }
    switch (policy.type) {
      case 'TimelockStart': return NativeScript.new_timelock_start(TimelockStart.new(BigNum.from_str(policy.slot.toString())))
      case 'TimelockExpiry': return NativeScript.new_timelock_expiry(TimelockExpiry.new(BigNum.from_str(policy.slot.toString())))
    }
    const nativeScripts = NativeScripts.new()
    policy.policies.forEach((policy) => {
      nativeScripts.add(this.getNativeScriptFromPolicy(policy, getKeyHash))
    })
    switch (policy.type) {
      case 'All': return NativeScript.new_script_all(ScriptAll.new(nativeScripts))
      case 'Any': return NativeScript.new_script_any(ScriptAny.new(nativeScripts))
      case 'NofK': return NativeScript.new_script_n_of_k(ScriptNOfK.new(policy.number, nativeScripts))
    }
  }

  public getPaymentNativeScriptFromPolicy(policy: Policy): NativeScript {
    return this.getNativeScriptFromPolicy(policy, (address) => {
      const keyHash = address.as_base()?.payment_cred().to_keyhash()
      if (!keyHash) throw new Error('No key hash of payment')
      return keyHash
    })
  }

  public getStakingNativeScriptFromPolicy(policy: Policy): NativeScript {
    return this.getNativeScriptFromPolicy(policy, (address) => {
      const keyHash = address.as_base()?.stake_cred().to_keyhash()
      if (!keyHash) throw new Error('No key hash of staking')
      return keyHash
    })
  }

  public getPolicyAddress(policy: Policy, isMainnet: boolean): Address {
    const { Address, BaseAddress, StakeCredential, NetworkInfo } = this.lib
    if (typeof policy === 'string') return Address.from_bech32(policy)
    const paymentScript = this.getPaymentNativeScriptFromPolicy(policy)
    const stakingScript = this.getStakingNativeScriptFromPolicy(policy)
    const networkId = isMainnet ? NetworkInfo.mainnet() : NetworkInfo.testnet()
    const payment = StakeCredential.from_scripthash(paymentScript.hash())
    const staking = StakeCredential.from_scripthash(stakingScript.hash())
    return BaseAddress.new(networkId.network_id(), payment, staking).to_address()
  }

  public getPolicyRewardAddress(policy: Policy, isMainnet: boolean): RewardAddress {
    const { RewardAddress, StakeCredential, NetworkInfo } = this.lib
    const networkInfo = isMainnet ? NetworkInfo.mainnet() : NetworkInfo.testnet()
    const networkId = networkInfo.network_id()
    if (typeof policy === 'string') {
      const credential = this.parseAddress(policy).staking_cred()
      if (!credential) throw new Error('Staking credential is missing')
      return RewardAddress.new(networkId, credential)
    }
    const script = this.getStakingNativeScriptFromPolicy(policy)
    return RewardAddress.new(networkId, StakeCredential.from_scripthash(script.hash()))
  }

  public getRequiredSignatures(script: NativeScript): number {
    const { NativeScriptKind } = this.lib
    const totalNumber = script.get_required_signers().len()
    switch (script.kind()) {
      case NativeScriptKind.ScriptAll: return totalNumber
      case NativeScriptKind.ScriptAny: return 1
      case NativeScriptKind.ScriptNOfK:
        const nofK = script.as_script_n_of_k()
        if (!nofK) throw new Error('cannot convert to ScriptNofK')
        return nofK.n()
      default: throw new Error(`Unsupported Script Type: ${script.kind()}`)
    }
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

export type { Cardano, CardanoIterable, Result, Recipient }
export { encodeCardanoData, getResult, toIter, toHex, useCardanoMultiplatformLib, verifySignature, Loader, newRecipient, isAddressNetworkCorrect, toAddressString }
