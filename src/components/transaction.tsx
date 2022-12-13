import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { MouseEventHandler, FC, ReactNode, ChangeEventHandler } from 'react'
import { AssetAmount, ADAAmount, LabeledCurrencyInput, getADASymbol, ADAInput } from './currency'
import { collectTransactionOutputs, decodeASCII, getAssetName, getBalanceByUTxOs, getPolicyId, useTransactionSummaryQuery, useStakePoolsQuery } from '../cardano/query-api'
import type { Value, RecipientRegistry } from '../cardano/query-api'
import { getResult, isAddressNetworkCorrect, newRecipient, toAddressString, toHex, toIter, useCardanoMultiplatformLib, verifySignature } from '../cardano/multiplatform-lib'
import type { Cardano, Recipient } from '../cardano/multiplatform-lib'
import type { Address, Certificate, Transaction, TransactionHash, TransactionInput, Vkeywitness, SingleInputBuilder, InputBuilderResult, SingleCertificateBuilder, CertificateBuilderResult, TransactionWitnessSet, TransactionOutputs, SingleWithdrawalBuilder, WithdrawalBuilderResult } from '@dcspark/cardano-multiplatform-lib-browser'
import { DocumentDuplicateIcon, MagnifyingGlassCircleIcon, ShareIcon, ArrowUpTrayIcon, PlusIcon, XMarkIcon, XCircleIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, WalletIcon } from '@heroicons/react/24/solid'
import Link from 'next/link'
import { ConfigContext, isMainnet } from '../cardano/config'
import type { Config } from '../cardano/config'
import { CopyButton, Hero, Panel, ShareCurrentURLButton, Toggle, Modal, TextareaModalBox } from './layout'
import { CardanoScanLink } from './address'
import { PasswordBox } from './password'
import { NotificationContext } from './notification'
import Image from 'next/image'
import Gun from 'gun'
import type { IGunInstance } from 'gun'
import { getTransactionPath } from '../route'
import { Loading, ProgressBar, SpinnerIcon } from './status'
import { NativeScriptViewer, SignatureViewer, Timelock } from './native-script'
import type { StakePool, TransactionOutput, ProtocolParams } from '@cardano-graphql/client-ts/api'
import init, { select } from 'cardano-utxo-wasm'
import type { Output } from 'cardano-utxo-wasm'
import { estimateSlotByDate } from '../cardano/utils'
import { SlotInput } from './wallet'
import { DateContext } from './time'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { PersonalWallet } from '../db'
import { AddressableContent } from './address'

const TransactionReviewButton: FC<{
  className?: string
  transaction: Transaction
}> = ({ className, transaction }) => {
  return (
    <Link href={getTransactionPath(transaction)}>
      <a className={['text-white bg-sky-700', className].join(' ')}>Review Transaction</a>
    </Link>
  )
}

const CertificateListing: FC<{
  cardano: Cardano
  certificate: Certificate
}> = ({ cardano, certificate }) => {
  const [config, _] = useContext(ConfigContext)
  const networkId: number = useMemo(() => cardano.getNetworkId(isMainnet(config)), [cardano, config])

  let cert

  cert = certificate.as_stake_registration()
  if (cert) {
    const { RewardAddress } = cardano.lib
    const rewardAddress = RewardAddress.new(networkId, cert.stake_credential()).to_address().to_bech32()
    return (
      <>
        <h2 className='font-semibold'>Stake Registration</h2>
        <AddressableContent content={rewardAddress} scanType='stakekey' />
      </>
    )
  }

  cert = certificate.as_stake_deregistration()
  if (cert) {
    const { RewardAddress } = cardano.lib
    const rewardAddress = RewardAddress.new(networkId, cert.stake_credential()).to_address().to_bech32()
    return (
      <>
        <h2 className='font-semibold'>Stake Deregistration</h2>
        <AddressableContent content={rewardAddress} scanType='stakekey' />
      </>
    )
  }

  cert = certificate.as_stake_delegation()
  if (cert) {
    const { RewardAddress } = cardano.lib
    const rewardAddress = RewardAddress.new(networkId, cert.stake_credential()).to_address().to_bech32()
    const poolId = cert.pool_keyhash().to_bech32('pool')
    return (
      <>
        <h2 className='font-semibold'>Stake Delegation</h2>
        <AddressableContent content={rewardAddress} scanType='stakekey' />
        <AddressableContent content={poolId} scanType='pool' />
      </>
    )
  }

  throw new Error('Unsupported Certificate')
}

const CertificateList: FC<{
  cardano: Cardano
  ulClassName?: string
  liClassName?: string
  certificates: Certificate[]
}> = ({ cardano, ulClassName, liClassName, certificates }) => {
  return (
    <ul className={ulClassName}>
      {certificates.map((certificate, index) => <li className={liClassName} key={index}><CertificateListing cardano={cardano} certificate={certificate} /></li>)}
    </ul>
  )
}

const RecipientViewer: FC<{
  className?: string
  recipient: Recipient
}> = ({ className, recipient }) => {
  const { address, value } = recipient

  return (
    <div className={className}>
      <AddressableContent content={address} scanType='address' />
      <ul>
        <li><ADAAmount lovelace={value.lovelace} /></li>
        {Array.from(value.assets).map(([id, quantity]) =>
          <li key={id}>
            <AssetAmount
              quantity={quantity}
              decimals={0}
              symbol={decodeASCII(getAssetName(id))} />
          </li>
        )}
      </ul>
    </div>
  )
}

const getTxHash = (input: TransactionInput) => input.transaction_id().to_hex()
const getTxIndex = (input: TransactionInput) => parseInt(input.index().to_str())

const TransactionInputViewer: FC<{
  className?: string
  registry?: RecipientRegistry
  input: TransactionInput
}> = ({ className, input, registry }) => {
  const hash = getTxHash(input)
  const index = getTxIndex(input)
  const recipient = useMemo(() => registry?.get(hash)?.get(index), [hash, index, registry])

  if (recipient) return (
    <RecipientViewer className={className} recipient={recipient} />
  )

  return (
    <div className={className}>
      <div className='break-all'>{hash}#{index}</div>
    </div>
  )
}

type WalletAPI = {
  signTx(tx: string, partialSign: boolean): Promise<string>
  submitTx(tx: string): Promise<string>
  getNetworkId(): Promise<number>
}

type CIP30Wallet = {
  enable(): Promise<WalletAPI>
  name: string
  icon: string
  apiVersion: string
}

const CIP30WalletIcon: FC<{
  height?: number
  width?: number
  className?: string
  wallet: CIP30Wallet
}> = ({ height, width, wallet, className }) => {
  const { name, icon } = wallet
  return (
    <Image
      height={height || 25}
      width={width || 25}
      className={className}
      alt={name}
      src={icon}
    />
  )
}

type CIP30WalletName = 'eternl' | 'nami' | 'gero' | 'flint'

const getCIP30Wallet = (name: CIP30WalletName): CIP30Wallet | undefined => {
  const cardano = (window as any).cardano
  switch (name) {
    case 'eternl': return cardano?.eternl
    case 'nami': return cardano?.nami
    case 'gero': return cardano?.gerowallet
    case 'flint': return cardano?.flint
  }
}

type TxSignError = {
  code: 1 | 2
  info: string
}

const CIP30Names: CIP30WalletName[] = ['nami', 'gero', 'eternl', 'flint']
const SignTxButtonClassName = 'flex w-full items-center justify-between py-2 px-4 text-sky-700 disabled:bg-gray-100 disabled:text-gray-500 hover:bg-sky-100'
const SignTxButton: FC<{
  className?: string
  onSuccess: (signature: string) => void
  transaction: Transaction
  requiredKeyHashHexes: string[]
  children: ReactNode
}> = ({ className, onSuccess, transaction, requiredKeyHashHexes, children }) => {
  const cardano = useCardanoMultiplatformLib()
  const { notify } = useContext(NotificationContext)
  const txHash = useMemo(() => cardano?.lib.hash_transaction(transaction.body()).to_bytes(), [cardano, transaction])
  const [modal, setModal] = useState(false)
  const closeModal = useCallback(() => setModal(false), [])
  const openModal = useCallback(() => setModal(true), [])
  const personalWallets = useLiveQuery(async () => db.personalWallets.toArray())
  const [signingWallet, setSigningWallet] = useState<PersonalWallet | 'import' | undefined>()
  useEffect(() => {
    if (!modal) setSigningWallet(undefined)
  }, [modal])
  const signWithPersonalWallet = useCallback(async (password: string) => {
    if (!signingWallet || signingWallet === 'import' || !cardano || !txHash) return
    cardano
      .signWithPersonalWallet(requiredKeyHashHexes, txHash, signingWallet, password)
      .then((vkeywitnesses) => {
        const { TransactionWitnessSetBuilder } = cardano.lib
        const builder = TransactionWitnessSetBuilder.new()
        vkeywitnesses.forEach((vkeywitness) => builder.add_vkey(vkeywitness))
        onSuccess(toHex(builder.build()))
        notify('success', 'Signed successfully')
      })
      .catch((error) => {
        notify('error', 'Failed to sign')
        console.error(error)
      })
      .finally(() => closeModal())
  }, [cardano, closeModal, onSuccess, requiredKeyHashHexes, signingWallet, txHash, notify])
  const isDisabled: boolean = useMemo(() => !signingWallet || !cardano || !txHash, [signingWallet, cardano, txHash])
  const [CIP30Wallets, setCIP30Wallets] = useState(new Map<CIP30WalletName, CIP30Wallet>())
  useEffect(() => {
    setCIP30Wallets(CIP30Names.reduce((result, name) => {
      const wallet = getCIP30Wallet(name)
      if (wallet) result.set(name, wallet)
      return result
    }, new Map()))
  }, [])
  const importSignature = useCallback((signature: string) => {
    onSuccess(signature)
    closeModal()
  }, [closeModal, onSuccess])

  return (
    <>
      <button onClick={openModal} className={className}>{children}</button>
      {modal && <Modal className='bg-white divide-y text-center rounded w-80 overflow-hidden' onBackgroundClick={closeModal}>
        {!signingWallet && <>
          <header>
            <h2 className='font-semibold p-4 bg-gray-100'>Choose a wallet</h2>
          </header>
          <nav className='divide-y text-sky-700'>
            {personalWallets?.map((wallet) => <button
              key={wallet.id}
              onClick={() => setSigningWallet(wallet)}
              className={SignTxButtonClassName}>
              <WalletIcon className='w-6' />
              <span>{wallet.name}</span>
            </button>)}
            <button onClick={() => setSigningWallet('import')} className={SignTxButtonClassName}>
              <ArrowUpTrayIcon className='w-6' />
              <span>Import</span>
            </button>
            {Array.from(CIP30Wallets, ([name, wallet]) => <CIP30SignTxButton
              key={name}
              transaction={transaction}
              partialSign={true}
              sign={onSuccess}
              onFinish={closeModal}
              wallet={wallet}
              className={SignTxButtonClassName}>
              <CIP30WalletIcon wallet={wallet} className='w-4' />
              <span>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
            </CIP30SignTxButton>)}
            <button onClick={closeModal} className='w-full text-center text-sky-700 p-2 hover:bg-sky-100'>Cancel</button>
          </nav>
        </>}
        {signingWallet && <>
          <header>
            <button
              onClick={() => setSigningWallet(undefined)}
              className='flex w-full items-center justify-center space-x-1 text-sky-700 p-2 hover:bg-sky-100'>
              <ChevronLeftIcon className='w-4' />
              <span>Choose Others</span>
            </button>
          </header>
          {signingWallet !== 'import' && <PasswordBox
            disabled={isDisabled}
            title={signingWallet.name}
            onConfirm={signWithPersonalWallet}>
            <PencilIcon className='w-4' />
            <span>Sign</span>
          </PasswordBox>}
          {signingWallet === 'import' && <TextareaModalBox placeholder='Input signature here and import' onConfirm={importSignature}>
            <ArrowUpTrayIcon className='w-4' />
            <span>Import</span>
          </TextareaModalBox>}
        </>}
      </Modal>}
    </>
  )
}

const CIP30SignTxButton: FC<{
  className?: string,
  children: ReactNode
  transaction: Transaction,
  partialSign: boolean,
  sign: (_: string) => void,
  onFinish?: () => void
  wallet: CIP30Wallet
}> = ({ wallet, transaction, partialSign, sign, className, children, onFinish }) => {

  const [config, _] = useContext(ConfigContext)
  const { notify } = useContext(NotificationContext)

  const onClick: MouseEventHandler<HTMLButtonElement> = useCallback(() => {
    wallet
      .enable()
      .then(async (walletAPI) => {
        const networkId = await walletAPI.getNetworkId()
        if (isMainnet(config) ? networkId !== 1 : networkId !== 0) {
          notify('error', 'Wrong network.')
          return
        }
        return walletAPI
          .signTx(toHex(transaction), partialSign)
          .then(sign)
      })
      .catch((reason: Error | TxSignError) => {
        if ('info' in reason) {
          notify('error', reason.info)
          return
        }
        if ('message' in reason) {
          notify('error', reason.message)
          return
        }
        console.error(reason)
      })
      .finally(onFinish)
  }, [wallet, config, notify, onFinish, partialSign, sign, transaction])

  return (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  )
}

const submitTx = (URL: string, body: Uint8Array) => fetch(URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/cbor' },
  body
}).then(async (response) => {
  if (!response.ok) {
    await response.text().then((message: string): Error => {
      if (message.search(/\(ScriptWitnessNotValidatingUTXOW /) !== -1) {
        throw {
          name: 'InvalidSignatureError',
          message: 'The signatures are invalid.'
        }
      }
      if (message.search(/\(BadInputsUTxO /) !== -1) {
        throw {
          name: 'DuplicatedSpentError',
          message: 'The UTxOs have been spent.'
        }
      }
      console.error(message)
      throw {
        name: 'TxSubmissionError',
        message: 'An unknown error. Check the log.'
      }
    })
  }
  return response
})

const SubmitTxButton: FC<{
  className?: string
  children: ReactNode
  transaction: Transaction
}> = ({ className, children, transaction }) => {
  const [config, _] = useContext(ConfigContext)
  const { notify } = useContext(NotificationContext)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDisabled, setIsDisabled] = useState(false)

  const clickHandle: MouseEventHandler<HTMLButtonElement> = () => {
    setIsSubmitting(true)
    const promises = config.submitAPI.map((URL) => submitTx(URL, transaction.to_bytes()))
    Promise
      .any(promises)
      .then(() => {
        notify('success', 'The transaction is submitted.')
      })
      .catch((reason: AggregateError) => {
        const duplicatedSpentError: Error = reason.errors.find((error) => error.name === 'DuplicatedSpentError')
        if (duplicatedSpentError) {
          setIsDisabled(true)
          notify('error', duplicatedSpentError.message)
          return
        }
        const invalidSignatureError: Error = reason.errors.find((error) => error.name === 'InvalidSignatureError')
        if (invalidSignatureError) {
          notify('error', invalidSignatureError.message)
          return
        }
        const error: Error = reason.errors[0]
        notify('error', error.message)
      })
      .finally(() => setIsSubmitting(false))
  }

  return (
    <button onClick={clickHandle} className={className} disabled={isDisabled || isSubmitting}>
      {isSubmitting ? 'Submitting' : children}
    </button>
  )
}

const WalletInfo: FC<{
  className?: string
  children: ReactNode
  name: CIP30WalletName
  src: string
}> = ({ name, className, children, src }) => {
  const [wallet, setWallet] = useState<CIP30Wallet | undefined>(undefined)

  useEffect(() => {
    let isMounted = true

    isMounted && setWallet(getCIP30Wallet(name))

    return () => {
      isMounted = false
    }
  }, [name])

  return (
    <li className={className}>
      <div className='h-9'>
        <Image src={src} width={36} height={36} alt={name} />
      </div>
      <div>
        <div className='font-semibold'>{children}</div>
        <div className='text-sm text-gray-700'>{wallet?.apiVersion ?? 'Not Installed'}</div>
      </div>
    </li>
  )
}

const SignatureSync: FC<{
  cardano: Cardano
  txHash: TransactionHash
  signatures: Map<string, Vkeywitness>
  addSignatures: (witnessSetHex: string) => void
  signers: Set<string>
  config: Config
}> = ({ cardano, txHash, signatures, signers, addSignatures, config }) => {
  const [isOn, setIsOn] = useState(false)
  const [gun, setGUN] = useState<IGunInstance<any> | undefined>(undefined)
  const switchToggle = useCallback(() => setIsOn(!isOn), [isOn])
  const peers = config.gunPeers
  const network = config.network

  useEffect(() => {
    let isMounted = true

    const gun = new Gun({ peers })
    isMounted && setGUN(gun)

    return () => {
      isMounted = false
    }
  }, [peers])

  useEffect(() => {
    if (isOn && gun) {
      const nodes = Array.from(signers).map((keyHashHex) => {
        const vkeywitness = signatures.get(keyHashHex)
        const node = gun
          .get('cardano')
          .get(network)
          .get('transactions')
          .get(toHex(txHash))
          .get(keyHashHex)

        if (vkeywitness) {
          const hex = cardano.buildSignatureSetHex([vkeywitness])
          node.put(hex)
          node.on((data) => {
            if (data !== hex) node.put(hex)
          })
        } else {
          node.on(addSignatures)
        }

        return node
      })

      return () => {
        nodes.forEach((node) => node.off())
      }
    }
  })

  return (
    <Toggle isOn={isOn} onChange={switchToggle} />
  )
}

const CopyVkeysButton: FC<{
  cardano: Cardano
  className?: string
  children: ReactNode
  vkeys: Vkeywitness[]
}> = ({ cardano, className, children, vkeys }) => {
  const hex = useMemo(() => cardano.buildSignatureSetHex(vkeys), [cardano, vkeys])

  return (
    <CopyButton
      content={hex}
      disabled={vkeys.length === 0}
      ms={500}
      className={className}>
      {children}
    </CopyButton>
  )
}

const TransactionLoader: FC<{
  content: Uint8Array
}> = ({ content }) => {
  const cardano = useCardanoMultiplatformLib()
  const transaction = useMemo(() => cardano?.lib.Transaction.from_bytes(content), [cardano, content])

  if (!cardano || !transaction) return (
    <Modal><Loading /></Modal>
  )

  return (
    <TransactionViewer cardano={cardano} transaction={transaction} />
  )
}

type SignatureMap = Map<string, Vkeywitness>

const updateSignatureMap = (witnessSet: TransactionWitnessSet, signatureMap: SignatureMap, txHash: TransactionHash): SignatureMap => {
  const result = new Map(signatureMap)
  const vkeyWitnessSet = witnessSet.vkeys()
  if (!vkeyWitnessSet) return result

  Array.from(toIter(vkeyWitnessSet), (vkeyWitness) => {
    const publicKey = vkeyWitness.vkey().public_key()
    const keyHashHex = publicKey.hash().to_hex()
    if (verifySignature(txHash, vkeyWitness)) {
      result.set(keyHashHex, vkeyWitness)
    }
  })

  return result
}

const getRecipientsFromCMLTransactionOutputs = (outputs: TransactionOutputs): Recipient[] => Array.from(toIter(outputs), (output, index) => {
  const address = toAddressString(output.address())
  const amount = output.amount()
  const assets = new Map()
  const multiAsset = amount.multiasset()
  if (multiAsset) {
    Array.from(toIter(multiAsset.keys()), (policyId) => {
      const _asset = multiAsset.get(policyId)
      _asset && Array.from(toIter(_asset.keys()), (assetName) => {
        const quantity = BigInt(multiAsset.get_asset(policyId, assetName).to_str())
        const id = policyId.to_hex() + toHex(assetName.name())
        assets.set(id, (assets.get(id) ?? BigInt(0)) + quantity)
      })
    })
  }
  return {
    id: index.toString(),
    address,
    value: {
      lovelace: BigInt(amount.coin().to_str()),
      assets
    }
  }
})

const TransactionViewer: FC<{
  cardano: Cardano
  transaction: Transaction
}> = ({ cardano, transaction }) => {
  const nativeScripts = useMemo(() => {
    const scriptSet = transaction.witness_set().native_scripts()
    if (scriptSet) return Array.from(toIter(scriptSet))
  }, [transaction])
  const txBody = useMemo(() => transaction.body(), [transaction])
  const txHash = useMemo(() => cardano.lib.hash_transaction(txBody), [cardano, txBody])
  const txWithdrawals = useMemo(() => {
    const result = new Map<string, bigint>()
    const withdrawals = txBody.withdrawals()
    if (!withdrawals) return result
    Array.from(toIter(withdrawals.keys()), (address) => {
      const amount = withdrawals.get(address)
      if (amount) result.set(address.to_address().to_bech32(), BigInt(amount.to_str()))
    })
    return result
  }, [txBody])
  const certificates = useMemo(() => {
    const certs = txBody.certs()
    if (!certs) return
    return Array.from(toIter(certs))
  }, [txBody])
  const requiredStakingKeys: Set<string> | undefined = useMemo(() => {
    if (!certificates && !txWithdrawals) return
    const collection = new Set<string>()

    certificates?.forEach((certificate) => {
      const cert = certificate.as_stake_registration() ??
        certificate.as_stake_delegation() ??
        certificate.as_stake_deregistration()
      const keyHashHex = cert?.stake_credential().to_keyhash()?.to_hex()
      keyHashHex && collection.add(keyHashHex)
    })
    txWithdrawals.forEach((_, address) => {
      const keyHashHex = cardano.parseAddress(address).as_reward()?.payment_cred().to_keyhash()?.to_hex()
      keyHashHex && collection.add(keyHashHex)
    })

    return collection
  }, [certificates, cardano, txWithdrawals])
  const [requiredPaymentKeys, setRequiredPaymentKeys] = useState<Set<string> | undefined>()
  const signerRegistry = useMemo(() => {
    const signers = new Set<string>()
    nativeScripts?.forEach((script) => {
      Array.from(toIter(script.get_required_signers()), (signer) => signers.add(toHex(signer)))
    })
    requiredPaymentKeys?.forEach((keyHash) => signers.add(keyHash))
    requiredStakingKeys?.forEach((keyHash) => signers.add(keyHash))
    return signers
  }, [nativeScripts, requiredPaymentKeys, requiredStakingKeys])
  const [signatureMap, setSignatureMap] = useState<SignatureMap>(updateSignatureMap(transaction.witness_set(), new Map(), txHash))
  const signedTransaction = useMemo(() => {
    const vkeys = new Array<Vkeywitness>()
    signatureMap.forEach((vkey, keyHashHex) => signerRegistry.has(keyHashHex) && vkeys.push(vkey))
    return cardano.signTransaction(transaction, vkeys)
  }, [cardano, transaction, signatureMap, signerRegistry])
  const txMessage = useMemo(() => cardano.getTxMessage(transaction), [cardano, transaction])
  const addSignatures = useCallback((witnessSetHex: string) => {
    const result = getResult(() => {
      const bytes = Buffer.from(witnessSetHex, 'hex')
      return cardano.lib.TransactionWitnessSet.from_bytes(bytes)
    })

    if (!result.isOk) return

    setSignatureMap(updateSignatureMap(result.data, signatureMap, txHash))
  }, [signatureMap, cardano, txHash])
  const fee = useMemo(() => BigInt(txBody.fee().to_str()), [txBody])
  const txInputs = useMemo(() => Array.from(toIter(txBody.inputs())), [txBody])
  const { data } = useTransactionSummaryQuery({ variables: { hashes: txInputs.map((input) => input.transaction_id().to_hex()) } })
  const txInputsRegistry = useMemo(() => data && collectTransactionOutputs(data.transactions), [data])
  useEffect(() => {
    const keyHashes = new Set<string>()
    txInputs.forEach((input) => {
      const hash = getTxHash(input)
      const index = getTxIndex(input)
      const address = txInputsRegistry?.get(hash)?.get(index)?.address
      const keyHash = address && cardano.parseAddress(address).payment_cred()?.to_keyhash()?.to_hex()
      keyHash && keyHashes.add(keyHash)
    })
    setRequiredPaymentKeys(keyHashes)
  }, [cardano, txInputs, txInputsRegistry, setRequiredPaymentKeys])
  const txOutputs: Recipient[] = useMemo(() => getRecipientsFromCMLTransactionOutputs(txBody.outputs()), [txBody])
  const startSlot = useMemo(() => {
    const slot = txBody.validity_start_interval()?.to_str()
    if (slot) return parseInt(slot)
  }, [txBody])
  const expirySlot = useMemo(() => {
    const slot = txBody.ttl()?.to_str()
    if (slot) return parseInt(slot)
  }, [txBody])

  return (
    <div className='space-y-2'>
      <Hero>
        <h1 className='font-semibold text-lg'>Review Transaction</h1>
        <p>If the transaction is correct, you can sign and submit it. If this transaction needs more than one signers, you can share them this URL to get it signed and share the signatures.</p>
        <nav>
          <ShareCurrentURLButton
            className='flex space-x-1 bg-white text-sky-700 py-1 px-2 rounded shadow w-32 justify-center items-center'>
            <ShareIcon className='w-4' />
            <span>Copy URL</span>
          </ShareCurrentURLButton>
        </nav>
      </Hero>
      <Panel>
        <div className='p-4 space-y-2'>
          <div className='space-y-1'>
            <h2 className='font-semibold'>Transaction ID</h2>
            <div className='text-sm'>
              <AddressableContent content={txHash.to_hex()} scanType='transaction' />
            </div>
          </div>
          {(startSlot || expirySlot) && <div className='space-y-1'>
            <h2 className='font-semibold'>Lifetime</h2>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-2'>
              <div className='border rounded p-2 text-sm'>
                {startSlot && <div className='flex items-center justify-between space-x-1'>
                  <span>Start slot:</span>
                  <Timelock slot={startSlot} type='TimelockStart' />
                </div>}
                {expirySlot && <div className='flex items-center justify-between space-x-1'>
                  <span>Expiry slot:</span>
                  <Timelock slot={expirySlot} type='TimelockExpiry' />
                </div>}
              </div>
            </div>
          </div>}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
            <div className='space-y-1'>
              <div className='font-semibold'>Inputs</div>
              <ul className='space-y-1 text-sm'>
                {txInputs.map((input, index) => <li key={index} className='p-2 border rounded'>
                  <TransactionInputViewer className='space-y-1' input={input} registry={txInputsRegistry} />
                </li>)}
                {Array.from(txWithdrawals, ([address, amount], index) => <li key={index} className='p-2 border rounded space-y-1'>
                  <AddressableContent content={address} scanType='stakekey' />
                  <div><ADAAmount lovelace={amount} /></div>
                </li>)}
              </ul>
            </div>
            <div className='space-y-1'>
              <div className='font-semibold'>Outputs</div>
              <ul className='space-y-1 text-sm'>
                {txOutputs.map((txOutput, index) => <li key={index} className='p-2 border rounded'>
                  <RecipientViewer className='space-y-1' recipient={txOutput} />
                </li>)}
                <li className='p-2 border rounded space-x-1'>
                  <ADAAmount lovelace={fee} />
                  <span>Fee</span>
                </li>
              </ul>
            </div>
          </div>
          {certificates && <div className='space-y-1'>
            <div className='font-semibold'>Certificates</div>
            <CertificateList
              cardano={cardano}
              ulClassName='grid grid-cols-1 md:grid-cols-2 gap-2 text-sm'
              liClassName='p-2 border rounded break-all'
              certificates={certificates} />
          </div>}
          {txMessage && <div className='space-y-1'>
            <div className='font-semibold'>Message</div>
            <div className='p-2 border rounded text-sm break-all'>{txMessage.map((line, index) => <p key={index}>{line}</p>)}</div>
          </div>}
          {requiredPaymentKeys && requiredPaymentKeys.size > 0 && <div className='space-y-1'>
            <h2 className='font-semibold'>Required Payment Signatures</h2>
            <ul className='space-y-1 rounded border p-2 text-sm'>
              {Array.from(requiredPaymentKeys, (keyHashHex, index) => <li key={index}>
                <SignatureViewer
                  className='flex space-x-1 items-center'
                  signedClassName='text-green-500'
                  name={keyHashHex}
                  signature={cardano.buildSignatureSetHex(signatureMap.get(keyHashHex))} />
              </li>)}
            </ul>
          </div>}
          {requiredStakingKeys && requiredStakingKeys.size > 0 && <div className='space-y-1'>
            <h2 className='font-semibold'>Required Staking Signatures</h2>
            <ul className='space-y-1 rounded border p-2 text-sm'>
              {Array.from(requiredStakingKeys, (keyHashHex, index) => <li key={index}>
                <SignatureViewer
                  className='flex space-x-1 items-center'
                  signedClassName='text-green-500'
                  name={keyHashHex}
                  signature={cardano.buildSignatureSetHex(signatureMap.get(keyHashHex))} />
              </li>)}
            </ul>
          </div>}
          {nativeScripts && nativeScripts.length > 0 && <div className='space-y-1'>
            <h2 className='font-semibold'>Native Scripts</h2>
            <ul className='space-y-1 text-sm'>
              {nativeScripts.map((script, index) => <li key={index}>
                <NativeScriptViewer
                  cardano={cardano}
                  verifyingData={signatureMap}
                  className='p-2 border rounded space-y-2'
                  headerClassName='font-semibold'
                  ulClassName='space-y-1'
                  nativeScript={script} />
              </li>)}
            </ul>
          </div>}
        </div>
        <footer className='flex p-4 bg-gray-100 space-x-2'>
          <SignTxButton
            transaction={transaction}
            requiredKeyHashHexes={Array.from(signerRegistry)}
            onSuccess={addSignatures}
            className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-gray-100 disabled:text-gray-400'>
            <PencilIcon className='w-4' />
            <span>Sign</span>
          </SignTxButton>
          <CopyVkeysButton
            cardano={cardano}
            vkeys={Array.from(signatureMap.values())}
            className='flex items-center space-x-1 p-2 disabled:border rounded text-sky-700 border disabled:bg-gray-100 disabled:text-gray-400'>
            <ShareIcon className='w-4' />
            <span>Copy Signatures</span>
          </CopyVkeysButton>
          <div className='flex grow justify-end items-center space-x-4'>
            <SubmitTxButton
              className='flex p-2 items-center space-x-1 bg-sky-700 text-white rounded disabled:border disabled:bg-gray-100 disabled:text-gray-400'
              transaction={signedTransaction}>
              <ArrowUpTrayIcon className='w-4' />
              <span>Submit</span>
            </SubmitTxButton>
          </div>
        </footer>
      </Panel>
    </div>
  )
}

const AddAssetButton: FC<{
  budget: Value
  value: Value
  onSelect: (id: string) => void
}> = ({ budget, value, onSelect }) => {
  const assets = useMemo(() => Array
    .from(budget.assets)
    .filter(([id, quantity]) => !value.assets.has(id) && quantity > BigInt(0)), [budget, value])

  return (
    <div className='relative'>
      <button
        className='flex text-sky-700 py-2 space-x-1 peer items-center disabled:text-gray-400'
        disabled={assets.length <= 0}>
        <PlusIcon className='w-4' />
        <span>Add Asset</span>
      </button>
      <ul className='absolute divide-y bg-white text-sm max-h-64 border rounded shadow overflow-y-auto scale-0 z-50 peer-focus:scale-100 hover:scale-100'>
        {assets.map(([id, quantity]) => (
          <li key={id}>
            <button
              onClick={() => onSelect(id)}
              className='block w-full h-full p-2 hover:bg-sky-100'>
              <div className='flex space-x-2'>
                <span>{decodeASCII(getAssetName(id))}</span>
                <span>{quantity.toString()}</span>
              </div>
              <div className='flex space-x-1'>
                <span className='text-xs font-light'>{id.slice(0, 56)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const RecipientAddressInput: FC<{
  address: string
  cardano: Cardano
  className?: string
  disabled?: boolean
  setAddress: (address: string) => void
}> = ({ address, cardano, className, disabled, setAddress }) => {
  const [config, _] = useContext(ConfigContext)

  const isValid = cardano.isValidAddress(address) && isAddressNetworkCorrect(config, cardano.parseAddress(address))

  return (
    <div className={className}>
      <label className='flex block border rounded overflow-hidden ring-sky-500 focus-within:ring-1'>
        <span className='p-2 bg-gray-100 border-r'>To</span>
        <input
          className={['p-2 block w-full disabled:bg-gray-100', isValid ? '' : 'text-red-500'].join(' ')}
          disabled={disabled}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder='Address' />
      </label>
      {address && !isValid && <p className='text-sm text-red-500'>The address is invalid.</p>}
    </div>
  )
}

const TransactionRecipient: FC<{
  cardano: Cardano
  recipient: Recipient
  budget: Value
  getMinLovelace: (recipient: Recipient) => bigint
  onChange: (recipient: Recipient) => void
}> = ({ cardano, recipient, budget, getMinLovelace, onChange }) => {

  const [config, _] = useContext(ConfigContext)
  const setRecipient = useCallback((recipient: Recipient) => {
    onChange(recipient)
  }, [onChange])
  const setAddress = useCallback((address: string) => {
    setRecipient({ ...recipient, address })
  }, [setRecipient, recipient])
  const setLovelace = useCallback((lovelace: bigint) => {
    const { value } = recipient
    setRecipient({ ...recipient, value: { ...value, lovelace } })
  }, [setRecipient, recipient])
  const setAsset = useCallback((id: string, quantity: bigint) => {
    const { value } = recipient
    setRecipient({
      ...recipient,
      value: {
        ...value,
        assets: new Map(value.assets).set(id, quantity)
      }
    })
  }, [setRecipient, recipient])
  const deleteAsset = useCallback((id: string) => {
    const { value } = recipient
    const newAssets = new Map(value.assets)
    newAssets.delete(id)
    setRecipient({
      ...recipient,
      value: { ...value, assets: newAssets }
    })
  }, [setRecipient, recipient])

  const minLovelace = useMemo(() => cardano.isValidAddress(recipient.address) ? getMinLovelace(recipient) : undefined, [recipient, cardano, getMinLovelace])
  const selectAsset = useCallback((id: string) => setAsset(id, BigInt(0)), [setAsset])

  return (
    <div className='p-4 space-y-2'>
      <RecipientAddressInput address={recipient.address} setAddress={setAddress} cardano={cardano} />
      <div>
        <LabeledCurrencyInput
          symbol={getADASymbol(config)}
          decimal={6}
          value={recipient.value.lovelace}
          min={minLovelace}
          max={recipient.value.lovelace + budget.lovelace}
          onChange={setLovelace}
          placeholder='0.000000' />
        {minLovelace ? <p className='text-sm space-x-1'>
          <span>At least</span>
          <button
            onClick={() => setLovelace(minLovelace)}
            className='text-sky-700 font-semibold'>
            <ADAAmount lovelace={minLovelace} />
          </button>
          <span>is required</span>
        </p> : null}
      </div>
      <ul className='space-y-2'>
        {Array.from(recipient.value.assets).map(([id, quantity]) => {
          const symbol = decodeASCII(getAssetName(id))
          const assetBudget = (budget.assets.get(id) || BigInt(0))
          const onChange = (value: bigint) => setAsset(id, value)
          return (
            <li key={id} className='flex space-x-2'>
              <LabeledCurrencyInput
                symbol={symbol}
                decimal={0}
                value={quantity}
                max={quantity + assetBudget}
                maxButton={true}
                onChange={onChange} />
              <button className='p-2' onClick={() => deleteAsset(id)}>
                <XMarkIcon className='w-4' />
              </button>
            </li>
          )
        })}
      </ul>
      <AddAssetButton budget={budget} value={recipient.value} onSelect={selectAsset} />
    </div>
  )
}

const TransactionMessageInput: FC<{
  className?: string
  messageLines: string[]
  onChange: (messageLines: string[]) => void
}> = ({ className, messageLines, onChange }) => {
  const getLines = (text: string): string[] => text.split(/\r?\n/g)
  const changeHandle: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    onChange(getLines(event.target.value))
  }
  const isValid = messageLines.every((line) => new TextEncoder().encode(line).length <= 64)

  return (
    <textarea
      className={[className, isValid ? '' : 'text-red-500'].join(' ')}
      placeholder='Optional transaction message'
      rows={4}
      value={messageLines.join("\n")}
      onChange={changeHandle}>
    </textarea>
  )
}

const NewTransaction: FC<{
  cardano: Cardano
  protocolParameters: ProtocolParams
  utxos: TransactionOutput[]
  buildInputResult: (builder: SingleInputBuilder) => InputBuilderResult
  buildCertResult: (builder: SingleCertificateBuilder) => CertificateBuilderResult
  buildWithdrawalResult: (builder: SingleWithdrawalBuilder) => WithdrawalBuilderResult
  defaultChangeAddress: string
  rewardAddress: string
  availableReward: bigint
  isRegistered: boolean
  currentDelegation?: StakePool
}> = ({ cardano, protocolParameters, buildInputResult, buildCertResult, buildWithdrawalResult, rewardAddress, availableReward, utxos, defaultChangeAddress, isRegistered, currentDelegation }) => {
  const [config, _c] = useContext(ConfigContext)
  const [now, _t] = useContext(DateContext)
  const currentSlot = estimateSlotByDate(now, config.network)
  const [startSlot, setStartSlot] = useState<number | undefined>(currentSlot)
  const [expirySlot, setExpirySlot] = useState<number | undefined>(currentSlot + 24 * 60 * 60)
  const [recipients, setRecipients] = useState<Recipient[]>([newRecipient()])
  const [message, setMessage] = useState<string[]>([])
  const [inputs, setInputs] = useState<TransactionOutput[]>([])
  const [changeAddress, setChangeAddress] = useState<string>(defaultChangeAddress)
  const [isChangeSettingDisabled, setIsChangeSettingDisabled] = useState(true)
  const [willSpendAll, setWillSpendAll] = useState(false)
  const [minLovelaceForChange, setMinLovelaceForChange] = useState(BigInt(5e6))
  const [modal, setModal] = useState<'delegation' | 'start' | 'expiry' | undefined>()
  const [delegation, setDelegation] = useState<StakePool | undefined>()
  const deposit: bigint = useMemo(() => {
    if (!isRegistered && delegation) return BigInt(protocolParameters.keyDeposit)
    return BigInt(0)
  }, [isRegistered, delegation, protocolParameters])
  const budget: Value = useMemo(() => recipients
    .map(({ value }) => value)
    .concat({ lovelace: deposit, assets: new Map() })
    .reduce((result, value) => {
      const lovelace = result.lovelace - value.lovelace
      const assets = new Map(result.assets)
      Array.from(value.assets).forEach(([id, quantity]) => {
        const _quantity = assets.get(id)
        _quantity && assets.set(id, _quantity - quantity)
      })
      return { lovelace, assets }
    }, getBalanceByUTxOs(utxos)), [deposit, recipients, utxos])
  const stakeRegistration = useMemo(() => {
    if (!isRegistered && delegation) return cardano.createRegistrationCertificate(rewardAddress)
  }, [cardano, delegation, rewardAddress, isRegistered])
  const stakeDelegation = useMemo(() => {
    if (delegation) return cardano.createDelegationCertificate(rewardAddress, delegation.id)
  }, [cardano, delegation, rewardAddress])
  const [stakeDeregistration, setStakeDeregistration] = useState<Certificate | undefined>()
  const [withdrawAll, setWithdrawAll] = useState(false)

  useEffect(() => {
    if (stakeDeregistration) {
      setDelegation(undefined)
      availableReward > BigInt(0) && setWithdrawAll(true)
    }
  }, [availableReward, stakeDeregistration])

  const auxiliaryData = useMemo(() => {
    if (message.length > 0) {
      const { AuxiliaryData, MetadataJsonSchema } = cardano.lib
      const value = JSON.stringify({
        msg: message
      })
      let data = AuxiliaryData.new()
      data.add_json_metadatum_with_schema(cardano.getMessageLabel(), value, MetadataJsonSchema.NoConversions)
      return data
    }
  }, [cardano, message])

  const closeModal = useCallback(() => setModal(undefined), [])
  const delegate = useCallback((stakePool: StakePool) => {
    setDelegation(stakePool)
    closeModal()
  }, [closeModal])
  const confirmStartSlot = useCallback((slot: number) => {
    setStartSlot(slot)
    closeModal()
  }, [closeModal])
  const confirmExpirySlot = useCallback((slot: number) => {
    setExpirySlot(slot)
    closeModal()
  }, [closeModal])
  useEffect(() => {
    if (isChangeSettingDisabled) {
      setChangeAddress(defaultChangeAddress)
      setWillSpendAll(false)
    }
  }, [defaultChangeAddress, isChangeSettingDisabled])

  useEffect(() => {
    let isMounted = true

    if (willSpendAll || recipients.length === 0) {
      setInputs(utxos)
      return
    }

    setInputs([])

    init().then(() => {
      if (!isMounted) return

      const inputs: Output[] = utxos.map((txOutput) => {
        return {
          data: txOutput,
          lovelace: BigInt(txOutput.value),
          assets: txOutput.tokens.map((token) => {
            const assetId = token.asset.assetId
            return {
              policyId: getPolicyId(assetId),
              assetName: getAssetName(assetId),
              quantity: BigInt(token.quantity)
            }
          })
        }
      })
      const outputs: Output[] = recipients.map((recipient) => {
        return {
          lovelace: recipient.value.lovelace,
          assets: Array.from(recipient.value.assets).map(([id, quantity]) => {
            return {
              policyId: getPolicyId(id),
              assetName: getAssetName(id),
              quantity: BigInt(quantity)
            }
          })
        }
      })
      const result = select(inputs, outputs, { lovelace: minLovelaceForChange, assets: [] })
      const txOutputs: TransactionOutput[] | undefined = result?.selected.map((output) => output.data)
      txOutputs && setInputs(txOutputs)
    })

    return () => {
      isMounted = false
    }
  }, [utxos, recipients, willSpendAll, minLovelaceForChange])

  const getMinLovelace = useCallback((recipient: Recipient): bigint => cardano.getMinLovelace(recipient, protocolParameters), [cardano, protocolParameters])

  const txResult = useMemo(() => getResult(() => {
    if (inputs.length === 0) throw new Error('No UTxO is spent.')

    const { BigNum, ChangeSelectionAlgo, SingleCertificateBuilder } = cardano.lib
    const txBuilder = cardano.createTxBuilder(protocolParameters)

    inputs.forEach((input) => {
      const builder = cardano.createTxInputBuilder(input)
      txBuilder.add_input(buildInputResult(builder))
    })

    recipients.forEach((recipient) => {
      const result = cardano.buildTxOutput(recipient, protocolParameters)
      txBuilder.add_output(result)
    })

    if (stakeRegistration) txBuilder.add_cert(buildCertResult(SingleCertificateBuilder.new(stakeRegistration)))
    if (stakeDeregistration) txBuilder.add_cert(buildCertResult(SingleCertificateBuilder.new(stakeDeregistration)))
    if (stakeDelegation) txBuilder.add_cert(buildCertResult(SingleCertificateBuilder.new(stakeDelegation)))

    if (withdrawAll) {
      const builder = cardano.createWithdrawalBuilder(rewardAddress, availableReward)
      if (!builder) throw new Error('Failed to create withdrawal builder')
      txBuilder.add_withdrawal(buildWithdrawalResult(builder))
    }

    if (auxiliaryData) txBuilder.add_auxiliary_data(auxiliaryData)

    if (startSlot) txBuilder.set_validity_start_interval(BigNum.from_str(startSlot.toString()))
    if (expirySlot) txBuilder.set_ttl(BigNum.from_str(expirySlot.toString()))

    return txBuilder.build(ChangeSelectionAlgo.Default, cardano.parseAddress(changeAddress)).build_unchecked()
  }), [recipients, cardano, changeAddress, auxiliaryData, protocolParameters, inputs, stakeRegistration, stakeDelegation, buildInputResult, buildCertResult, buildWithdrawalResult, startSlot, expirySlot, availableReward, rewardAddress, withdrawAll, stakeDeregistration])

  const changeRecipient = useCallback((index: number, recipient: Recipient) => {
    setRecipients(recipients.map((_recipient, _index) => index === _index ? recipient : _recipient))
  }, [recipients])

  const deleteRecipient = useCallback((index: number) => {
    setRecipients(recipients.filter((_, _index) => index !== _index))
  }, [recipients])

  return (
    <Panel>
      <ul>
        {recipients.map((recipient, index) =>
          <li key={index}>
            <header className='flex justify-between px-4 py-2 bg-gray-100'>
              <h2 className='font-semibold'>Recipient #{index + 1}</h2>
              <nav className='flex items-center'>
                <button onClick={() => deleteRecipient(index)}>
                  <XMarkIcon className='w-4' />
                </button>
              </nav>
            </header>
            <TransactionRecipient
              cardano={cardano}
              recipient={recipient}
              budget={budget}
              getMinLovelace={getMinLovelace}
              onChange={(rec) => changeRecipient(index, rec)} />
          </li>
        )}
      </ul>
      {withdrawAll && <div>
        <header className='flex justify-between px-4 py-2 bg-gray-100'>
          <h2 className='font-semibold'>Withdraw Reward</h2>
          <nav className='flex items-center'>
            <button onClick={() => setWithdrawAll(false)}>
              <XMarkIcon className='w-4' />
            </button>
          </nav>
        </header>
        <div className='p-4 space-y-1'>
          <div>{rewardAddress}</div>
          <div className='p-2 border rounded'>
            <ADAAmount lovelace={availableReward} />
          </div>
        </div>
      </div>}
      {stakeDeregistration && <div>
        <header className='flex justify-between px-4 py-2 bg-gray-100'>
          <h2 className='font-semibold'>Stake Deregistration</h2>
          <nav className='flex items-center'>
            <button onClick={() => setStakeDeregistration(undefined)}>
              <XMarkIcon className='w-4' />
            </button>
          </nav>
        </header>
        <div className='p-4 space-y-1'>
          <div>{rewardAddress}</div>
        </div>
      </div>}
      {delegation && <div>
        <header className='flex justify-between px-4 py-2 bg-gray-100'>
          <div>
            <h2 className='font-semibold'>Delegation</h2>
          </div>
          <nav className='flex items-center'>
            <button onClick={() => setDelegation(undefined)}>
              <XMarkIcon className='w-4' />
            </button>
          </nav>
        </header>
        <div className='p-4 space-y-2'>
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-2'>
            {currentDelegation && <div className='space-y-1'>
              <strong className='font-semibold'>From</strong>
              <StakePoolInfo stakePool={currentDelegation} />
            </div>}
            <div className='space-y-1'>
              {currentDelegation && <strong className='font-semibold'>To</strong>}
              <StakePoolInfo stakePool={delegation} />
            </div>
          </div>
          {deposit > BigInt(0) && <p className='text-sm'>This address was not registered for staking. Will deposit <ADAAmount className='font-semibold' lovelace={deposit} /> to register.</p>}
        </div>
      </div>}
      <div>
        <header className='flex justify-between px-4 py-2 bg-gray-100'>
          <h2 className='font-semibold'>Lifetime</h2>
        </header>
        <div className='p-4 space-y-2'>
          <div className='flex items-center space-x-2'>
            <span>Start slot:</span>
            {startSlot ? <Timelock slot={startSlot} type='TimelockStart' /> : <span>N/A</span>}
            <nav className='divide-x items-center border rounded text-xs text-sky-700'>
              <button onClick={() => setModal('start')} className='px-2 py-1'>Change</button>
              <button onClick={() => setStartSlot(undefined)} className='px-2 py-1'>Remove</button>
            </nav>
            {modal === 'start' && <Modal className='bg-white p-4 rounded sm:w-full md:w-1/2 lg:w-1/3 space-y-1' onBackgroundClick={closeModal}>
              <h2 className='font-semibold'>Start Slot</h2>
              <SlotInput className='space-y-2' confirm={confirmStartSlot} cancel={closeModal} initialSlot={startSlot} />
            </Modal>}
          </div>
          <div className='flex items-center space-x-2'>
            <span>Expire slot:</span>
            {expirySlot ? <Timelock slot={expirySlot} type='TimelockExpiry' /> : <span>N/A</span>}
            <nav className='divide-x items-center border rounded text-xs text-sky-700'>
              <button onClick={() => setModal('expiry')} className='px-2 py-1'>Change</button>
              <button onClick={() => setExpirySlot(undefined)} className='px-2 py-1'>Remove</button>
            </nav>
            {modal === 'expiry' && <Modal className='bg-white p-4 rounded sm:w-full md:w-1/2 lg:w-1/3 space-y-1' onBackgroundClick={closeModal}>
              <h2 className='font-semibold'>Expiry Slot</h2>
              <SlotInput className='space-y-2' confirm={confirmExpirySlot} cancel={closeModal} initialSlot={startSlot} />
            </Modal>}
          </div>
        </div>
      </div>
      <div>
        <header className='px-4 py-2 bg-gray-100'>
          <h2 className='font-semibold'>{recipients.length > 0 ? 'Change' : 'Send All'}</h2>
          <p className='text-sm'>{recipients.length > 0 ? 'The change caused by this transaction or all remaining assets in the treasury will be sent to this address (default to the treasury address). DO NOT MODIFY IT UNLESS YOU KNOW WHAT YOU ARE DOING!' : 'All assets in this treasury will be sent to this address.'}</p>
          {recipients.length > 0 && <p>
            <label className='text-sm items-center space-x-1'>
              <input
                type='checkbox'
                checked={!isChangeSettingDisabled}
                onChange={() => setIsChangeSettingDisabled(!isChangeSettingDisabled)} />
              <span>I know the risk and I want to do it.</span>
            </label>
          </p>}
        </header>
        <div className='p-4 space-y-2'>
          <RecipientAddressInput
            cardano={cardano}
            disabled={isChangeSettingDisabled && recipients.length > 0}
            address={changeAddress}
            setAddress={setChangeAddress} />
          {!willSpendAll && recipients.length > 0 && <div className='space-y-1'>
            <label className='flex block border rounded overflow-hidden ring-sky-500 focus-within:ring-1'>
              <span className='p-2 bg-gray-100 border-r'>Least Change ADA</span>
              <ADAInput
                disabled={isChangeSettingDisabled}
                className='p-2 grow disabled:bg-gray-100'
                lovelace={minLovelaceForChange}
                setLovelace={setMinLovelaceForChange} />
            </label>
            <div className='text-sm'>Default to 5. The more tokens you have the larger it needs to create transaction properly.</div>
          </div>}
          {!isChangeSettingDisabled && recipients.length > 0 && <div>
            <label className='items-center space-x-1'>
              <input
                type='checkbox'
                checked={willSpendAll}
                onChange={() => setWillSpendAll(!willSpendAll)} />
              <span>Send all remaining assets in the treasury to this address</span>
            </label>
          </div>}
        </div>
      </div>
      <div>
        <header className='px-4 py-2 bg-gray-100'>
          <h2 className='font-semibold'>Message</h2>
          <p className='text-sm'>Cannot exceed 64 bytes each line.</p>
        </header>
        <TransactionMessageInput
          className='p-4 block w-full ring-sky-500 ring-inset focus:ring-1'
          onChange={setMessage}
          messageLines={message} />
      </div>
      <footer className='flex p-4 bg-gray-100 items-center'>
        <div className='grow'>
          {txResult.isOk && <p className='flex space-x-1'>
            <span>Fee:</span>
            <span><ADAAmount lovelace={BigInt(txResult.data.body().fee().to_str())} /></span>
          </p>}
          {!txResult.isOk && <p className='flex space-x-1 text-red-500 items-center'>
            <XCircleIcon className='h-4 w-4' />
            <span>{txResult.message === 'The address is invalid.' ? 'Some addresses are invalid.' : txResult.message}</span>
          </p>}
        </div>
        <nav className='flex justify-end space-x-2'>
          <button
            className='p-2 rounded text-sky-700 border'
            onClick={() => setRecipients(recipients.concat(newRecipient()))}>
            Add Recipient
          </button>
          <button
            disabled={withdrawAll || availableReward === BigInt(0)}
            className='p-2 rounded text-sky-700 border disabled:bg-gray-100 disabled:text-gray-400'
            onClick={() => setWithdrawAll(true)}>
            Withdraw
          </button>
          <button
            disabled={!isRegistered || !!stakeDeregistration}
            className='p-2 rounded text-red-700 border disabled:bg-gray-100 disabled:text-gray-400'
            onClick={() => isRegistered && setStakeDeregistration(cardano.createDeregistrationCertificate(rewardAddress))}>
            Deregister
          </button>
          <button
            disabled={!!stakeDeregistration}
            className='p-2 rounded text-sky-700 border disabled:bg-gray-100 disabled:text-gray-400'
            onClick={() => setModal('delegation')}>
            Delegate
          </button>
          {modal === 'delegation' && <Modal className='bg-white p-4 rounded w-full lg:w-1/2' onBackgroundClick={closeModal}>
            <StakePoolPicker className='space-y-2' delegate={delegate} />
          </Modal>}
          {txResult.isOk && <TransactionReviewButton className='px-4 py-2 rounded' transaction={txResult.data} />}
        </nav>
      </footer>
    </Panel>
  )
}

const StakePoolPicker: FC<{
  className?: string
  delegate: (_: StakePool) => void
}> = ({ className, delegate }) => {
  const limit = 6
  const [id, setId] = useState('')
  const [page, setPage] = useState(1)
  const isIdBlank = id.trim().length === 0
  const { data } = useStakePoolsQuery({
    variables: {
      id: isIdBlank ? undefined : id,
      limit,
      offset: (page - 1) * limit
    }
  })
  const stakePools = data?.stakePools

  return (
    <div className={className}>
      <h2 className='text-lg font-semibold'>Staking Pools</h2>
      <div className='flex items-center border rounded overflow-hidden ring-sky-500 focus-within:ring-1'>
        <input
          onChange={(e) => setId(e.target.value)}
          type='search'
          className='block p-2 grow'
          placeholder='Search by Pool ID' />
        <span className='p-2'>
          <MagnifyingGlassIcon className='w-4' />
        </span>
      </div>
      {stakePools && <ul className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2'>
        {stakePools.map((stakePool) => <li key={stakePool.id}><StakePoolInfo stakePool={stakePool} delegate={delegate} /></li>)}
      </ul>}
      {isIdBlank && data && <nav className='flex items-center justify-between'>
        <button
          className='px-2 py-1 border rounded text-sky-700 disabled:text-gray-100'
          onClick={() => setPage(page - 1)}
          disabled={page === 1}>
          <ChevronLeftIcon className='w-4' />
        </button>
        <button
          onClick={() => setPage(page + 1)}
          className='px-2 py-1 border rounded text-sky-700'>
          <ChevronRightIcon className='w-4' />
        </button>
      </nav>}
    </div>
  )
}

type StakePoolMetaData = { name: string, description: string, ticker: string, homepage: string }

const fetchStakePoolMetaData = async (url: string): Promise<StakePoolMetaData> =>
  fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to fetch ${URL}`)
      return response.json()
    }).catch((error) => console.error(error))

const StakePoolInfo: FC<{
  stakePool: StakePool
  delegate?: (_: StakePool) => void
}> = ({ delegate, stakePool }) => {
  const [metaData, setMetaData] = useState<StakePoolMetaData | undefined>()
  const [config, _] = useContext(ConfigContext)
  const stakedAmount = parseInt(stakePool.activeStake_aggregate?.aggregate?.sum.amount ?? '0')
  const maxStaked = 64e12
  const isRetired = stakePool.retirements && stakePool.retirements.length > 0
  const { SMASH } = config
  const [loading, setLoading] = useState(false)
  const saturationRate = useMemo(() => Math.round(stakedAmount / maxStaked * 100), [stakedAmount, maxStaked])
  const saturationBarClassName = useMemo(() => {
    if (saturationRate <= 90) return 'bg-green-700 h-4'
    if (saturationRate > 90 && saturationRate <= 95) return 'bg-yellow-700 h-4'
    if (saturationRate > 95) return 'bg-red-700 h-4'
  }, [saturationRate])

  useEffect(() => {
    let isMounted = true

    const id: string = stakePool.hash
    const hash: string | undefined = stakePool.metadataHash
    const url = hash && new URL(['api/v1/metadata', id, hash].join('/'), SMASH)

    if (url) {
      setLoading(true)
      fetchStakePoolMetaData(url.toString())
        .then((data) => isMounted && setMetaData(data))
        .finally(() => isMounted && setLoading(false))
    }

    return () => {
      isMounted = false
    }
  }, [stakePool, SMASH])

  return (
    <div className='border rounded divide-y shadow'>
      <header className='space-y-1 p-2'>
        <div className='text-sky-700'>
          {loading && <SpinnerIcon className='animate-spin w-4' />}
          {!loading && metaData && <Link href={metaData.homepage}>
            <a className='block truncate' target='_blank'>
              [<strong>{metaData.ticker}</strong>] {metaData.name}
            </a>
          </Link>}
        </div>
        {!loading && !metaData && <div className='text-gray-700'>{isRetired ? 'Retired' : 'Unknown'}</div>}
        <div className='text-xs break-all'>{stakePool.id}</div>
      </header>
      <div className='p-2 text-sm space-y-1'>
        <div>
          <div className='flex space-x-1 items-center justify-between'>
            <span className='font-semibold'>Saturation:</span>
            <div className='grow'>
              <div className='rounded bg-gray-700 overflow-hidden relative'>
                <ProgressBar className={saturationBarClassName} value={stakedAmount} max={maxStaked} />
                <div className='absolute inset-0 text-xs text-center text-white'>
                  {saturationRate}%
                </div>
              </div>
            </div>
          </div>
          <div className='flex space-x-1 items-center justify-between'>
            <span className='font-semibold'>Margin:</span>
            <span>{stakePool.margin * 100}%</span>
          </div>
          <div className='flex space-x-1 items-center justify-between'>
            <span className='font-semibold'>Fixed Fees:</span>
            <ADAAmount lovelace={BigInt(stakePool.fixedCost)} />
          </div>
          <div className='flex space-x-1 items-center justify-between'>
            <span className='font-semibold'>Pledge:</span>
            <ADAAmount lovelace={BigInt(stakePool.pledge)} />
          </div>
          <div className='flex space-x-1 items-center justify-between'>
            <span className='font-semibold'>Produced Blocks:</span>
            <span>{stakePool.blocks_aggregate.aggregate?.count}</span>
          </div>
        </div>
        {delegate && <nav>
          <button
            className='block w-full border rounded text-sm text-white p-1 bg-sky-700'
            onClick={() => delegate(stakePool)}>
            Delegate
          </button>
        </nav>}
      </div>
    </div>
  )
}

export { CIP30SignTxButton, SubmitTxButton, SignatureSync, CopyVkeysButton, WalletInfo, TransactionReviewButton, TransactionViewer, NewTransaction, StakePoolInfo, TransactionLoader }
