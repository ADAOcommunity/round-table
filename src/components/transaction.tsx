import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { MouseEventHandler, FC, ReactNode, ChangeEventHandler } from 'react'
import { AssetAmount, ADAAmount, LabeledCurrencyInput, getADASymbol, ADAInput } from './currency'
import { decodeASCII, getAssetName, getBalanceByUTxOs, getPolicyId, useStakePoolsQuery } from '../cardano/query-api'
import type { Value } from '../cardano/query-api'
import { getResult, isAddressNetworkCorrect, newRecipient, toAddressString, toHex, toIter, useCardanoMultiplatformLib, verifySignature } from '../cardano/multiplatform-lib'
import type { Cardano, Recipient } from '../cardano/multiplatform-lib'
import type { Address, Certificate, Transaction, TransactionBody, TransactionHash, TransactionInput, Vkeywitness, SingleInputBuilder, InputBuilderResult, SingleCertificateBuilder, CertificateBuilderResult } from '@dcspark/cardano-multiplatform-lib-browser'
import { DocumentDuplicateIcon, MagnifyingGlassCircleIcon, ShareIcon, ArrowUpTrayIcon, PlusIcon, XMarkIcon, XCircleIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import Link from 'next/link'
import { Config, ConfigContext } from '../cardano/config'
import { CardanoScanLink, CopyButton, Hero, Panel, ShareCurrentURLButton, Toggle } from './layout'
import { NotificationContext } from './notification'
import Image from 'next/image'
import Gun from 'gun'
import type { IGunInstance } from 'gun'
import { getTransactionPath } from '../route'
import { Loading, ProgressBar } from './status'
import { NativeScriptViewer } from './native-script'
import type { StakePool, TransactionOutput, ProtocolParams } from '@cardano-graphql/client-ts/api'
import init, { select } from 'cardano-utxo-wasm'
import type { Output } from 'cardano-utxo-wasm'
import { Modal } from './modal'

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

const TransactionInputListing: FC<{
  className?: string
  input: TransactionInput
}> = ({ className, input }) => {
  const hash = useMemo(() => input.transaction_id().to_hex(), [input])
  const index = useMemo(() => input.index().to_str(), [input])
  return (
    <li className={className}>{hash}#{index}</li>
  )
}

const TransactionInputList: FC<{
  ulClassName?: string
  liClassName?: string
  inputs: TransactionInput[]
}> = ({ ulClassName, liClassName, inputs }) => {
  return (
    <ul className={ulClassName}>
      {inputs.map((input, index) => <TransactionInputListing className={liClassName} key={index} input={input} />)}
    </ul>
  )
}

const CertificateListing: FC<{
  cardano: Cardano
  certificate: Certificate
}> = ({ cardano, certificate }) => {
  const [config, _] = useContext(ConfigContext)
  const networkId = useMemo(() => {
    const { NetworkInfo } = cardano.lib
    if (config.isMainnet) {
      return NetworkInfo.mainnet().network_id()
    } else {
      return NetworkInfo.testnet().network_id()
    }
  }, [cardano, config])

  let cert

  cert = certificate.as_stake_registration()
  if (cert) {
    const { RewardAddress } = cardano.lib
    const rewardAddress = RewardAddress.new(networkId, cert.stake_credential()).to_address().to_bech32()
    return (
      <>
        <h2 className='font-semibold'>Stake Registration</h2>
        <div>{rewardAddress}</div>
      </>
    )
  }

  cert = certificate.as_stake_delegation()
  if (cert) {
    const { RewardAddress } = cardano.lib
    const rewardAddress = RewardAddress.new(networkId, cert.stake_credential()).to_address().to_bech32()
    return (
      <>
        <h2 className='font-semibold'>Stake Delegation</h2>
        <div>{rewardAddress}</div>
        <div>{cert.pool_keyhash().to_bech32('pool')}</div>
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

const TransactionBodyViewer: FC<{
  txBody: TransactionBody
  cardano: Cardano
}> = ({ cardano, txBody }) => {
  const txHash = useMemo(() => cardano.lib.hash_transaction(txBody), [cardano, txBody])
  const fee = useMemo(() => BigInt(txBody.fee().to_str()), [txBody])
  const txInputs = useMemo(() => Array.from(toIter(txBody.inputs())), [txBody])
  const recipients: Recipient[] = useMemo(() => Array.from(toIter(txBody.outputs()), (output, index) => {
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
  }), [txBody])
  const certificates = useMemo(() => {
    const certs = txBody.certs()
    if (!certs) return
    return Array.from(toIter(certs))
  }, [txBody])

  return (
    <Panel className='p-4 space-y-2'>
      <div className='space-y-1'>
        <div className='font-semibold'>Transaction Hash</div>
        <div className='flex items-center space-x-1'>
          <span>{toHex(txHash)}</span>
          <span>
            <CardanoScanLink className='block text-sky-700 p-2' type='transaction' id={toHex(txHash)}><MagnifyingGlassCircleIcon className='w-4' /></CardanoScanLink>
          </span>
        </div>
      </div>
      <div className='flex space-x-2'>
        <div className='basis-1/2 space-y-1'>
          <div className='font-semibold'>Inputs</div>
          <TransactionInputList ulClassName='space-y-1' liClassName='p-2 border rounded break-all' inputs={txInputs} />
        </div>
        <div className='basis-1/2 space-y-1'>
          <div className='font-semibold'>Outputs</div>
          <ul className='space-y-1'>
            {recipients.map(({ id, address, value }) =>
              <li key={id} className='p-2 border rounded-md'>
                <p className='flex space-x-1 break-all'>{address}</p>
                <p>
                  <ADAAmount lovelace={value.lovelace} />
                </p>
                <ul>
                  {Array.from(value.assets).map(([id, quantity]) =>
                    <li key={id}>
                      <AssetAmount
                        quantity={quantity}
                        decimals={0}
                        symbol={decodeASCII(getAssetName(id))} />
                    </li>
                  )}
                </ul>
              </li>
            )}
            <li className='p-2 border rounded-md space-x-1'>
              <span>Fee:</span>
              <ADAAmount lovelace={fee} />
            </li>
          </ul>
        </div>
      </div>
      {certificates && <div className='space-y-1'>
        <div className='font-semibold'>Certificates</div>
        <CertificateList
          cardano={cardano}
          ulClassName='grid grid-cols-1 md:grid-cols-2 gap-2'
          liClassName='p-2 border rounded break-all'
          certificates={certificates} />
      </div>}
    </Panel>
  )
}

const AddressViewer: FC<{
  address: Address
}> = ({ address }) => {
  const bech32 = address.to_bech32()
  return (
    <span className='flex items-center'>
      <span>{bech32}</span>
      <CopyButton className='p-2 text-sm text-sky-700' getContent={() => bech32} ms={500}>
        <DocumentDuplicateIcon className='w-4' />
      </CopyButton>
    </span>
  )
}

type WalletAPI = {
  signTx(tx: string, partialSign: boolean): Promise<string>
  submitTx(tx: string): Promise<string>
  getNetworkId(): Promise<number>
}

type Wallet = {
  enable(): Promise<WalletAPI>
  name: string
  icon: string
  apiVersion: string
}

const WalletIcon: FC<{
  height?: number
  width?: number
  className?: string
  wallet: Wallet
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

type WalletName = 'eternl' | 'nami' | 'gero' | 'flint'

const getWallet = (name: WalletName): Wallet | undefined => {
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

const SignTxButton: FC<{
  className?: string,
  transaction: Transaction,
  partialSign: boolean,
  signHandle: (_: string) => void,
  name: WalletName
}> = ({ name, transaction, partialSign, signHandle, className }) => {

  const [config, _] = useContext(ConfigContext)
  const { notify } = useContext(NotificationContext)
  const [wallet, setWallet] = useState<Wallet | undefined>(undefined)

  useEffect(() => {
    let isMounted = true

    isMounted && setWallet(getWallet(name))

    return () => {
      isMounted = false
    }
  }, [name])

  if (!wallet) return null

  const errorHandle = (reason: Error | TxSignError) => {
    if ('info' in reason) {
      notify('error', reason.info)
      return
    }
    if ('message' in reason) {
      notify('error', reason.message)
      return
    }
    console.error(reason)
  }

  const clickHandle: MouseEventHandler<HTMLButtonElement> = async () => {
    const walletAPI = await wallet.enable().catch(errorHandle)
    if (!walletAPI) return;
    const networkId = await walletAPI.getNetworkId()
    if (config.isMainnet ? networkId !== 1 : networkId !== 0) {
      notify('error', `${name} is on wrong network.`)
      return
    }
    walletAPI
      .signTx(toHex(transaction), partialSign)
      .then(signHandle)
      .catch(errorHandle)
  }

  return (
    <button className={className} onClick={clickHandle}>
      <span className='flex items-center space-x-1'>
        <WalletIcon wallet={wallet} className='w-4' />
        <span>Sign with {name}</span>
      </span>
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
  name: WalletName
  src: string
}> = ({ name, className, children, src }) => {
  const [wallet, setWallet] = useState<Wallet | undefined>(undefined)

  useEffect(() => {
    let isMounted = true

    isMounted && setWallet(getWallet(name))

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
  signHandle: (_: string) => void
  signers: Set<string>
  config: Config
}> = ({ cardano, txHash, signatures, signers, signHandle, config }) => {
  const [isOn, setIsOn] = useState(false)
  const [gun, setGUN] = useState<IGunInstance<any> | undefined>(undefined)
  const peers = config.gunPeers
  const network = config.isMainnet ? 'mainnet' : 'testnet'

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
          node.on(signHandle)
        }

        return node
      })

      return () => {
        nodes.forEach((node) => node.off())
      }
    }
  })

  return (
    <Toggle isOn={isOn} onChange={() => setIsOn(!isOn)} />
  )
}

const CopyVkeysButton: FC<{
  cardano: Cardano
  className?: string
  children: ReactNode
  vkeys: Vkeywitness[]
}> = ({ cardano, className, children, vkeys }) => {
  return (
    <CopyButton
      getContent={() => cardano.buildSignatureSetHex(vkeys)}
      disabled={vkeys.length <= 0}
      ms={500}
      className={className}>
      {children}
    </CopyButton>
  )
}

const ManualSign: FC<{
  children: ReactNode
  signHandle: (_: string) => void
}> = ({ children, signHandle }) => {
  const [signature, setSignature] = useState('')
  const isDisabled = !signature

  const manualSignHandle = () => {
    signHandle(signature)
    setSignature('')
  }

  return (
    <Panel>
      <textarea
        className='block w-full p-4 outline-none'
        rows={4}
        value={signature}
        onChange={(e) => setSignature(e.target.value)}
        placeholder="Input signature here and import">
      </textarea>
      <footer className='flex p-4 bg-gray-100 space-x-2'>
        <button
          onClick={manualSignHandle}
          disabled={isDisabled}
          className='flex items-center space-x-1 p-2 disabled:border rounded-md bg-sky-700 text-white disabled:bg-gray-100 disabled:text-gray-400'>
          <ArrowUpTrayIcon className='w-4' />
          <span>Import</span>
        </button>
        {children}
      </footer>
    </Panel>
  )
}

const TransactionViewer: FC<{
  content: Uint8Array
}> = ({ content }) => {
  const cardano = useCardanoMultiplatformLib()
  const [signatureMap, setSignatureMap] = useState<Map<string, Vkeywitness>>(new Map())
  const [config, _c] = useContext(ConfigContext)
  const transaction = useMemo(() => cardano?.lib.Transaction.from_bytes(content), [cardano, content])
  const nativeScripts = useMemo(() => {
    const scriptSet = transaction?.witness_set().native_scripts()
    if (scriptSet) return Array.from(toIter(scriptSet))
  }, [transaction])
  const signerRegistry = useMemo(() => {
    const signers = new Set<string>()
    nativeScripts?.forEach((script) => {
      Array.from(toIter(script.get_required_signers()), (signer) => signers.add(toHex(signer)))
    })
    return signers
  }, [nativeScripts])

  if (!cardano || !transaction) return (
    <Modal>
      <Loading />
    </Modal>
  )

  const txHash = cardano.lib.hash_transaction(transaction.body())

  const txMessage = cardano.getTxMessage(transaction)

  const signHandle = (signatures: string[] | string) => {
    const newMap = new Map(signatureMap)

    function getSignatures(): string[] {
      if (typeof signatures === 'string') return [signatures]
      return signatures
    }

    getSignatures().forEach((signature) => {
      const result = getResult(() => {
        const bytes = Buffer.from(signature, 'hex')
        return cardano.lib.TransactionWitnessSet.from_bytes(bytes)
      })

      if (!result.isOk) return

      const witnessSet = result.data
      const vkeyWitnessSet = witnessSet.vkeys()

      if (!vkeyWitnessSet) return

      Array.from(toIter(vkeyWitnessSet), (vkeyWitness) => {
        const publicKey = vkeyWitness.vkey().public_key()
        const keyHash = publicKey.hash()
        const hex = toHex(keyHash)
        if (signerRegistry.has(hex) && verifySignature(txHash, vkeyWitness)) {
          newMap.set(hex, vkeyWitness)
        }
      })
    })

    setSignatureMap(newMap)
  }

  const signedTransaction = cardano.signTransaction(transaction, signatureMap.values())

  return (
    <div className='space-y-2'>
      <Hero>
        <h1 className='font-semibold text-lg'>Review Transaction</h1>
        <p>Share current page URL to other signers so they can sign. After you have signed the transaction, you may copy your signatures to others to import. If the auto sync switch is on, your signatures would be exchanged automatically.</p>
        <nav>
          <ShareCurrentURLButton
            className='flex space-x-1 bg-white text-sky-700 py-1 px-2 rounded shadow w-32 justify-center items-center'>
            <ShareIcon className='w-4' />
            <span>Copy URL</span>
          </ShareCurrentURLButton>
        </nav>
      </Hero>
      <TransactionBodyViewer cardano={cardano} txBody={transaction.body()} />
      {txMessage && <Panel className='space-y-1 p-4'>
        <div className='font-semibold'>Message</div>
        <div>{txMessage.map((line, index) => <p key={index}>{line}</p>)}</div>
      </Panel>}
      {nativeScripts && nativeScripts.length > 0 && <Panel>
        <div className='p-4 space-y-2'>
          <h2 className='font-semibold'>Native Scripts</h2>
          <ul className='space-y-1'>
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
        </div>
        <footer className='flex p-4 bg-gray-100 space-x-2 justify-between'>
          <div className='flex space-x-1 items-center'>
            <SignatureSync
              cardano={cardano}
              txHash={txHash}
              signatures={signatureMap}
              signHandle={signHandle}
              signers={signerRegistry}
              config={config} />
            <div className='text-sm'>Auto sync the signatures with other signers</div>
          </div>
          <CopyVkeysButton
            cardano={cardano}
            vkeys={Array.from(signatureMap.values())}
            className='flex space-x-1 justify-center items-center p-2 border text-sky-700 rounded w-48 disabled:text-gray-400'>
            <ShareIcon className='w-4' />
            <span>Copy my signatures</span>
          </CopyVkeysButton>
        </footer>
      </Panel>}
      <ManualSign signHandle={signHandle}>
        <SignTxButton
          transaction={transaction}
          partialSign={true}
          signHandle={signHandle}
          name='nami'
          className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-gray-100 disabled:text-gray-400' />
        <SignTxButton
          transaction={transaction}
          partialSign={true}
          signHandle={signHandle}
          name='gero'
          className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-gray-100 disabled:text-gray-400' />
        <SignTxButton
          transaction={transaction}
          partialSign={true}
          signHandle={signHandle}
          name='eternl'
          className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-gray-100 disabled:text-gray-400' />
        <SignTxButton
          transaction={transaction}
          partialSign={true}
          signHandle={signHandle}
          name='flint'
          className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-gray-100 disabled:text-gray-400' />
        <div className='flex grow justify-end items-center space-x-4'>
          <SubmitTxButton
            className='py-2 px-4 font-semibold bg-sky-700 text-white rounded disabled:border disabled:bg-gray-100 disabled:text-gray-400'
            transaction={signedTransaction}>
            Submit Transaction
          </SubmitTxButton>
        </div>
      </ManualSign>
    </div>
  )
}

const AddAssetButton: FC<{
  budget: Value
  value: Value
  onSelect: (id: string) => void
}> = ({ budget, value, onSelect }) => {
  const assets = Array
    .from(budget.assets)
    .filter(([id, quantity]) => !value.assets.has(id) && quantity > BigInt(0))
  const isDisabled = assets.length <= 0

  return (
    <div className='relative'>
      <button
        className='flex text-sky-700 py-2 space-x-1 peer items-center disabled:text-gray-400'
        disabled={isDisabled}>
        <PlusIcon className='w-4' />
        <span>Add Asset</span>
      </button>
      <ul className='absolute divide-y bg-white text-sm max-h-64 border rounded shadow overflow-y-auto scale-0 z-50 peer-focus:scale-100 hover:scale-100'>
        {assets.map(([id, quantity]) => (
          <li key={id}>
            <button
              onClick={() => onSelect(id)}
              className='block w-full h-full p-2 hover:bg-sky-700 hover:text-white'>
              <div className='flex space-x-2'>
                <span>{decodeASCII(getAssetName(id))}</span>
                <span className='grow text-right'>{quantity.toString()}</span>
              </div>
              <div className='flex space-x-1'>
                <span className='text-xs'>{id.slice(0, 56)}</span>
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
      <label className='flex block border rounded overflow-hidden'>
        <span className='p-2 bg-gray-100 border-r'>To</span>
        <input
          className={['p-2 block w-full outline-none disabled:bg-gray-100', isValid ? '' : 'text-red-500'].join(' ')}
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
  const { address, value } = recipient
  const setRecipient = (recipient: Recipient) => {
    onChange(recipient)
  }
  const setAddress = (address: string) => {
    setRecipient({ ...recipient, address })
  }
  const setLovelace = (lovelace: bigint) => {
    setRecipient({ ...recipient, value: { ...value, lovelace } })
  }
  const setAsset = (id: string, quantity: bigint) => {
    setRecipient({
      ...recipient,
      value: {
        ...value,
        assets: new Map(value.assets).set(id, quantity)
      }
    })
  }
  const deleteAsset = (id: string) => {
    const newAssets = new Map(value.assets)
    newAssets.delete(id)
    setRecipient({
      ...recipient,
      value: { ...value, assets: newAssets }
    })
  }

  const minLovelace = cardano.isValidAddress(address) ? getMinLovelace(recipient) : undefined

  return (
    <div className='p-4 space-y-2'>
      <RecipientAddressInput address={address} setAddress={setAddress} cardano={cardano} />
      <div>
        <LabeledCurrencyInput
          symbol={getADASymbol(config)}
          decimal={6}
          value={value.lovelace}
          min={minLovelace}
          max={value.lovelace + budget.lovelace}
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
        {Array.from(value.assets).map(([id, quantity]) => {
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
      <AddAssetButton budget={budget} value={value} onSelect={(id) => setAsset(id, BigInt(0))} />
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
  defaultChangeAddress: string
  rewardAddress: string
  isRegistered: boolean
  currentDelegation?: StakePool
}> = ({ cardano, protocolParameters, buildInputResult, buildCertResult, rewardAddress, utxos, defaultChangeAddress, isRegistered, currentDelegation }) => {
  const [recipients, setRecipients] = useState<Recipient[]>([newRecipient()])
  const [message, setMessage] = useState<string[]>([])
  const [inputs, setInputs] = useState<TransactionOutput[]>([])
  const [changeAddress, setChangeAddress] = useState<string>(defaultChangeAddress)
  const [isChangeSettingDisabled, setIsChangeSettingDisabled] = useState(true)
  const [willSpendAll, setWillSpendAll] = useState(false)
  const [minLovelaceForChange, setMinLovelaceForChange] = useState(BigInt(5e6))
  const [isDelegationModalOn, setIsDelegationModalOn] = useState(false)
  const [delegation, setDelegation] = useState<StakePool | undefined>()

  const delegate = (stakePool: StakePool) => {
    setDelegation(stakePool)
    setIsDelegationModalOn(false)
  }

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

  const budget: Value = useMemo(() => recipients
    .map(({ value }) => value)
    .reduce((result, value) => {
      const lovelace = result.lovelace - value.lovelace
      const assets = new Map(result.assets)
      Array.from(value.assets).forEach(([id, quantity]) => {
        const _quantity = assets.get(id)
        _quantity && assets.set(id, _quantity - quantity)
      })
      return { lovelace, assets }
    }, getBalanceByUTxOs(utxos)), [recipients, utxos])

  const txResult = useMemo(() => getResult(() => {
    if (inputs.length === 0) throw new Error('No UTxO is spent.')

    const { AuxiliaryData, ChangeSelectionAlgo, MetadataJsonSchema } = cardano.lib
    const txBuilder = cardano.createTxBuilder(protocolParameters)

    inputs.forEach((input) => {
      const builder = cardano.createTxInputBuilder(input)
      txBuilder.add_input(buildInputResult(builder))
    })

    recipients.forEach((recipient) => {
      const result = cardano.buildTxOutput(recipient, protocolParameters)
      txBuilder.add_output(result)
    })

    if (delegation) {
      const { SingleCertificateBuilder } = cardano.lib
      if (!isRegistered) {
        const cert = cardano.createRegistrationCertificate(rewardAddress)
        if (!cert) throw new Error('Failed creating registration certificate')
        const builder = SingleCertificateBuilder.new(cert)
        txBuilder.add_cert(buildCertResult(builder))
      }
      const cert = cardano.createDelegationCertificate(rewardAddress, delegation.id)
      if (!cert) throw new Error('Failed creating delegation certificate')
      const builder = SingleCertificateBuilder.new(cert)
      txBuilder.add_cert(buildCertResult(builder))
    }

    if (message.length > 0) {
      const value = JSON.stringify({
        msg: message
      })
      let auxiliaryData = AuxiliaryData.new()
      auxiliaryData.add_json_metadatum_with_schema(cardano.getMessageLabel(), value, MetadataJsonSchema.NoConversions)
      txBuilder.add_auxiliary_data(auxiliaryData)
    }

    return txBuilder.build(ChangeSelectionAlgo.Default, cardano.parseAddress(changeAddress)).build_unchecked()
  }), [recipients, cardano, changeAddress, message, protocolParameters, inputs, delegation, isRegistered, rewardAddress, buildInputResult, buildCertResult])

  const handleRecipientChange = (recipient: Recipient) => {
    setRecipients(recipients.map((_recipient) => _recipient.id === recipient.id ? recipient : _recipient))
  }

  const deleteRecipient = (recipient: Recipient) => {
    setRecipients(recipients.filter(({ id }) => id !== recipient.id))
  }

  return (
    <Panel>
      <ul>
        {recipients.map((recipient, index) =>
          <li key={recipient.id}>
            <header className='flex justify-between px-4 py-2 bg-gray-100'>
              <h2 className='font-semibold'>Recipient #{index + 1}</h2>
              <nav className='flex items-center'>
                <button onClick={() => deleteRecipient(recipient)}>
                  <XMarkIcon className='w-4' />
                </button>
              </nav>
            </header>
            <TransactionRecipient
              cardano={cardano}
              recipient={recipient}
              budget={budget}
              getMinLovelace={getMinLovelace}
              onChange={handleRecipientChange} />
          </li>
        )}
      </ul>
      {delegation && <div>
        <header className='flex justify-between px-4 py-2 bg-gray-100'>
          <h2 className='font-semibold'>Delegation</h2>
          <nav className='flex items-center'>
            <button onClick={() => setDelegation(undefined)}>
              <XMarkIcon className='w-4' />
            </button>
          </nav>
        </header>
        <div className='p-4'>
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-2'>
            <StakePoolInfo stakePool={delegation} />
          </div>
        </div>
      </div>}
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
          {!willSpendAll && <div className='space-y-1'>
            <label className='flex block border rounded overflow-hidden'>
              <span className='p-2 bg-gray-100 border-r'>Least Change ADA</span>
              <ADAInput
                disabled={isChangeSettingDisabled}
                className='p-2 grow outline-none disabled:bg-gray-100'
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
          className='p-4 block w-full outline-none'
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
            className='p-2 rounded text-sky-700 border'
            onClick={() => setIsDelegationModalOn(true)}>
            Delegate
          </button>
          {isDelegationModalOn && <Modal className='bg-white p-4 rounded w-full lg:w-1/2' onBackgroundClick={() => setIsDelegationModalOn(false)}>
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
      <div className='flex items-center border rounded overflow-hidden'>
        <input
          onChange={(e) => setId(e.target.value)}
          type='search'
          className='block p-2 grow outline-none'
          placeholder='Search by Pool ID' />
        <span className='p-2'>
          <MagnifyingGlassIcon className='w-4' />
        </span>
      </div>
      {stakePools && <ul className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2'>
        {stakePools.map((stakePool, index) => <li key={index}><StakePoolInfo stakePool={stakePool} delegate={delegate} /></li>)}
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

  useEffect(() => {
    let isMounted = true

    const id: string = stakePool.hash
    const hash: string | undefined = stakePool.metadataHash
    const url = hash && new URL(['api/v1/metadata', id, hash].join('/'), SMASH)

    url && fetchStakePoolMetaData(url.toString()).then((data) => isMounted && setMetaData(data))

    return () => {
      isMounted = false
    }
  }, [stakePool, SMASH])

  return (
    <div className='border rounded divide-y shadow'>
      <header className='space-y-1 p-2'>
        {metaData ? <Link href={metaData.homepage}>
          <a className='block text-sky-700 truncate' target='_blank'>
            [<strong>{metaData.ticker}</strong>] {metaData.name}
          </a>
        </Link> : <div className='text-gray-700'>{isRetired ? 'Retired' : 'Unknown'}</div>}
        <div className='text-xs break-all'>{stakePool.id}</div>
      </header>
      <div className='p-2 text-sm space-y-1'>
        <div>
          <div className='flex space-x-1 items-center justify-between'>
            <span className='font-semibold'>Saturation:</span>
            <div className='grow'>
              <div className='rounded bg-gray-700 overflow-hidden relative'>
                <ProgressBar className='bg-green-700 h-4' value={stakedAmount} max={maxStaked} />
                <div className='absolute inset-0 text-xs text-center text-white'>
                  {Math.round(stakedAmount / maxStaked * 100)}%
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

export { AddressViewer, SignTxButton, SubmitTxButton, TransactionBodyViewer, SignatureSync, CopyVkeysButton, WalletInfo, TransactionReviewButton, ManualSign, TransactionViewer, NewTransaction, StakePoolInfo }
