import type { ProtocolParams, TransactionOutput } from '@cardano-graphql/client-ts/api'
import type { Address, BigNum, Bip32PrivateKey, Certificate, Ed25519KeyHash, NativeScript, RewardAddress, SingleInputBuilder, SingleOutputBuilderResult, Transaction, TransactionBuilder, TransactionHash, Value as CMLValue, Vkeywitness, PrivateKey, Bip32PublicKey, StakeCredential, SingleWithdrawalBuilder } from '@dcspark/cardano-multiplatform-lib-browser'
import { useEffect, useState } from 'react'
import { db } from '../db'
import type { PersonalAccount, PersonalWallet, MultisigAccount, Policy } from '../db'
import type { Config } from './config'
import type { Value } from './query-api'
import { getAssetName, getPolicyId } from './query-api'
import { decryptWithPassword, harden } from './utils'

const Fraction = require('fractional').Fraction
type Fraction = { numerator: number, denominator: number }

type CardanoWASM = typeof import('@dcspark/cardano-multiplatform-lib-browser')
type Recipient = {
  address: string
  value: Value
}

const newRecipient = (): Recipient => {
  return {
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

  public signTransaction(transaction: Transaction, vkeys: Vkeywitness[]): Transaction {
    const { Transaction, Vkeywitnesses } = this.lib
    const witnessSet = transaction.witness_set()
    const vkeyWitnessSet = Vkeywitnesses.new()
    vkeys.forEach((vkey) => vkeyWitnessSet.add(vkey))
    witnessSet.set_vkeys(vkeyWitnessSet)
    return Transaction.new(transaction.body(), witnessSet, transaction.auxiliary_data())
  }

  public buildSignatureSetHex(vkeys: Array<Vkeywitness> | Vkeywitness | undefined): string | undefined {
    if (!vkeys) return
    const { TransactionWitnessSetBuilder } = this.lib
    const builder = TransactionWitnessSetBuilder.new()
    if (Array.isArray(vkeys)) {
      vkeys.forEach((vkey) => builder.add_vkey(vkey))
    } else {
      builder.add_vkey(vkeys)
    }
    return toHex(builder.build())
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
    const { Address, BaseAddress, StakeCredential } = this.lib
    if (typeof policy === 'string') return Address.from_bech32(policy)
    const paymentScript = this.getPaymentNativeScriptFromPolicy(policy)
    const stakingScript = this.getStakingNativeScriptFromPolicy(policy)
    const networkId = this.getNetworkId(isMainnet)
    const payment = StakeCredential.from_scripthash(paymentScript.hash())
    const staking = StakeCredential.from_scripthash(stakingScript.hash())
    return BaseAddress.new(networkId, payment, staking).to_address()
  }

  public getPolicyRewardAddress(policy: Policy, isMainnet: boolean): RewardAddress {
    const { RewardAddress, StakeCredential } = this.lib
    const networkId = this.getNetworkId(isMainnet)
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

  public createRegistrationCertificate(rewardAddress: string): Certificate | undefined {
    const { Address, Certificate, StakeRegistration } = this.lib
    const credential = Address.from_bech32(rewardAddress).as_reward()?.payment_cred()
    if (!credential) return
    return Certificate.new_stake_registration(StakeRegistration.new(credential))
  }

  public createDelegationCertificate(rewardAddress: string, poolId: string): Certificate | undefined {
    const { Address, Certificate, StakeDelegation, Ed25519KeyHash } = this.lib
    const credential = Address.from_bech32(rewardAddress).as_reward()?.payment_cred()
    const poolKeyHash = Ed25519KeyHash.from_bech32(poolId)
    if (!credential) return
    return Certificate.new_stake_delegation(StakeDelegation.new(credential, poolKeyHash))
  }

  public createWithdrawalBuilder(rewardAddress: string, amount: bigint): SingleWithdrawalBuilder | undefined {
    const { Address, BigNum, SingleWithdrawalBuilder } = this.lib
    const address = Address.from_bech32(rewardAddress).as_reward()
    if (!address) return
    return SingleWithdrawalBuilder.new(address, BigNum.from_str(amount.toString()))
  }

  public getNetworkId(isMainnet: boolean): number {
    const { NetworkInfo } = this.lib
    const networkInfo = isMainnet ? NetworkInfo.mainnet() : NetworkInfo.testnet()
    return networkInfo.network_id()
  }

  public readRewardAddressFromPublicKey(bytes: Uint8Array, isMainnet: boolean): RewardAddress {
    const { RewardAddress, Bip32PublicKey, StakeCredential } = this.lib
    const networkId = this.getNetworkId(isMainnet)
    const publicKey = Bip32PublicKey.from_bytes(bytes)
    const credential = StakeCredential.from_keyhash(personalStakingKeyHash(publicKey))
    return RewardAddress.new(networkId, credential)
  }

  public sign(signingKey: PrivateKey, txHash: Uint8Array): Vkeywitness {
    const { Vkey, Vkeywitness } = this.lib
    const signature = signingKey.sign(txHash)
    const verifyingKey = Vkey.new(signingKey.to_public())
    return Vkeywitness.new(verifyingKey, signature)
  }

  public async getRootKey(wallet: PersonalWallet, password: string): Promise<Bip32PrivateKey> {
    return decryptWithPassword(wallet.rootKey, password, wallet.id)
      .then((plaintext) => this.lib.Bip32PrivateKey.from_bytes(new Uint8Array(plaintext)))
  }

  public async signWithPersonalWallet(requiredKeyHashHexes: string[], txHash: Uint8Array, wallet: PersonalWallet, password: string): Promise<Vkeywitness[]> {
    const rootKey = await this.getRootKey(wallet, password)
    const collection: Vkeywitness[] = []
    const requiredKeyHashes: Uint8Array[] = requiredKeyHashHexes.map((hex) => Buffer.from(hex, 'hex'))

    const keyHashIndices = await db.keyHashIndices.where('hash').anyOf(requiredKeyHashes).and(({ walletId }) => walletId === wallet.id).toArray()

    keyHashIndices.forEach(({ hash, derivationPath }) => {
      const signingKey = derivationPath.reduce((key, index) => key.derive(index), rootKey).to_raw_key()
      const publicKeyHash = signingKey.to_public().hash()
      if (publicKeyHash.to_hex() !== toHex(hash)) {
        console.error('Publich key hashes do not match')
        return
      }
      collection.push(this.sign(signingKey, txHash))
    })

    return collection
  }

  public async generatePersonalAccount(wallet: PersonalWallet, password: string) {
    const rootKey = await this.getRootKey(wallet, password)
    const accountIndex = wallet.personalAccounts.length
    wallet.personalAccounts.push({ publicKey: personalPublicKey(rootKey, accountIndex).as_bytes(), paymentKeyHashes: [] })
    Array.from({ length: 10 }, () => {
      this.generatePersonalAddress(wallet, accountIndex)
    })
  }

  public async generateMultisigAccount(wallet: PersonalWallet, password: string) {
    const rootKey = await this.getRootKey(wallet, password)
    const accountIndex = wallet.multisigAccounts.length
    wallet.multisigAccounts.push({ publicKey: multisigPublicKey(rootKey, accountIndex).as_bytes(), addresses: [] })
    Array.from({ length: 10 }, () => {
      this.generateMultisigAddress(wallet, accountIndex)
    })
  }

  public async generatePersonalAddress(wallet: PersonalWallet, accountIndex: number) {
    const account = wallet.personalAccounts[accountIndex]
    if (!account) throw new Error('No account found with this index')
    const { Bip32PublicKey } = this.lib
    const publicKey = Bip32PublicKey.from_bytes(account.publicKey)
    const index = account.paymentKeyHashes.length
    const paymentKeyHash = publicKey.derive(PAYMENT_ROLE).derive(index).to_raw_key().hash()
    const paymentPath = [harden(PERSONAL_PURPOSE), harden(COIN_TYPE), harden(accountIndex), PAYMENT_ROLE, index]
    const stakingKeyHash = personalStakingKeyHash(publicKey)
    const stakingPath = [harden(PERSONAL_PURPOSE), harden(COIN_TYPE), harden(accountIndex), STAKING_ROLE, 0]
    wallet.personalAccounts[accountIndex].paymentKeyHashes.push(paymentKeyHash.to_bytes())
    await db.keyHashIndices.put({ hash: paymentKeyHash.to_bytes(), derivationPath: paymentPath, walletId: wallet.id })
    await db.keyHashIndices.put({ hash: stakingKeyHash.to_bytes(), derivationPath: stakingPath, walletId: wallet.id })
  }

  public async generateMultisigAddress(wallet: PersonalWallet, accountIndex: number) {
    const account = wallet.multisigAccounts[accountIndex]
    if (!account) throw new Error('No account found with this index')
    const { Bip32PublicKey } = this.lib
    const publicKey = Bip32PublicKey.from_bytes(account.publicKey)
    const index = account.addresses.length
    const paymentKeyHash = publicKey.derive(PAYMENT_ROLE).derive(index).to_raw_key().hash()
    const paymentPath = [harden(MULTISIG_PURPOSE), harden(COIN_TYPE), harden(accountIndex), PAYMENT_ROLE, index]
    const stakingKeyHash = publicKey.derive(STAKING_ROLE).derive(index).to_raw_key().hash()
    const stakingPath = [harden(MULTISIG_PURPOSE), harden(COIN_TYPE), harden(accountIndex), STAKING_ROLE, index]
    wallet.multisigAccounts[accountIndex].addresses.push({
      paymentKeyHash: paymentKeyHash.to_bytes(),
      stakingKeyHash: stakingKeyHash.to_bytes()
    })
    await db.keyHashIndices.put({ hash: paymentKeyHash.to_bytes(), derivationPath: paymentPath, walletId: wallet.id })
    await db.keyHashIndices.put({ hash: stakingKeyHash.to_bytes(), derivationPath: stakingPath, walletId: wallet.id })
  }

  public readStakeCredentialFromKeyHash(bytes: Uint8Array): StakeCredential {
    const { Ed25519KeyHash, StakeCredential } = this.lib
    return StakeCredential.from_keyhash(Ed25519KeyHash.from_bytes(bytes))
  }

  public getAddressesFromPersonalAccount(account: PersonalAccount, isMainnet: boolean): string[] {
    const { BaseAddress, Bip32PublicKey, StakeCredential } = this.lib
    const publicKey = Bip32PublicKey.from_bytes(account.publicKey)
    const stakingKeyHash = personalStakingKeyHash(publicKey)
    const staking = StakeCredential.from_keyhash(stakingKeyHash)
    return account.paymentKeyHashes.map((paymentKeyHash) => {
      const payment = this.readStakeCredentialFromKeyHash(paymentKeyHash)
      const address = BaseAddress.new(this.getNetworkId(isMainnet), payment, staking).to_address().to_bech32()
      return address
    })
  }

  public getAddressesFromMultisigAccount(account: MultisigAccount, isMainnet: boolean): string[] {
    const { BaseAddress } = this.lib
    return account.addresses.map(({ paymentKeyHash, stakingKeyHash }) => {
      const payment = this.readStakeCredentialFromKeyHash(paymentKeyHash)
      const staking = this.readStakeCredentialFromKeyHash(stakingKeyHash)
      const address = BaseAddress.new(this.getNetworkId(isMainnet), payment, staking).to_address().to_bech32()
      return address
    })
  }
}

const personalStakingKeyHash = (publicKey: Bip32PublicKey): Ed25519KeyHash => publicKey.derive(STAKING_ROLE).derive(0).to_raw_key().hash()

const COIN_TYPE = 1815
const PAYMENT_ROLE = 0
const STAKING_ROLE = 2
const PERSONAL_PURPOSE = 1852
const MULTISIG_PURPOSE = 1854

function personalPublicKey(rootKey: Bip32PrivateKey, index: number): Bip32PublicKey {
  return rootKey
    .derive(harden(PERSONAL_PURPOSE))
    .derive(harden(COIN_TYPE))
    .derive(harden(index))
    .to_public()
}

function multisigPublicKey(rootKey: Bip32PrivateKey, index: number): Bip32PublicKey {
  return rootKey
    .derive(harden(MULTISIG_PURPOSE))
    .derive(harden(COIN_TYPE))
    .derive(harden(index))
    .to_public()
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
