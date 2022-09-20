import { MouseEventHandler, useContext, useEffect, useState } from 'react'
import type { FC, ReactNode } from 'react'
import { AssetAmount, ADAAmount } from './currency'
import { decodeASCII, getAssetName } from '../cardano/query-api'
import { Cardano, toHex } from '../cardano/multiplatform-lib'
import type { Recipient } from '../cardano/multiplatform-lib'
import type { Result } from '../cardano/multiplatform-lib'
import type { Address, NativeScript, Transaction, TransactionBody, TransactionHash, Vkeywitness } from '@dcspark/cardano-multiplatform-lib-browser'
import { DuplicateIcon, SearchIcon } from '@heroicons/react/solid'
import Link from 'next/link'
import { Config, ConfigContext } from '../cardano/config'
import { CardanoScanLink, CopyButton, Panel, Toggle } from './layout'
import { NotificationContext } from './notification'
import Image from 'next/image'
import { db } from '../db'
import Gun from 'gun'
import type { IGunInstance } from 'gun'
import { useRouter } from 'next/router'
import { useLiveQuery } from 'dexie-react-hooks'
import { getTransactionPath, getTreasuriesPath, getTreasuryPath } from '../route'

const TransactionReviewButton: FC<{
  className?: string
  result: Result<Transaction>
}> = ({ className, result }) => {
  if (!result.isOk) return (
    <div className={['text-gray-400 bg-gray-100 border cursor-not-allowed', className].join(' ')}>Review Transaction</div>
  )

  return (
    <Link href={getTransactionPath(result.data)}>
      <a className={['text-white bg-sky-700', className].join(' ')}>Review Transaction</a>
    </Link>
  )
}

const TransactionBodyViewer: FC<{
  txBody: TransactionBody
  cardano: Cardano
}> = ({ cardano, txBody }) => {
  const txHash = cardano.lib.hash_transaction(txBody)

  const fee = BigInt(txBody.fee().to_str())
  type TxInputSet = { isQueried: false, data: { txHash: string, index: number }[] }
  const txInputs: TxInputSet = {
    isQueried: false,
    data: Array.from({ length: txBody.inputs().len() }, (_, i) => {
      const input = txBody.inputs().get(i)
      return {
        txHash: toHex(input.transaction_id()),
        index: parseInt(input.index().to_str())
      }
    })
  }

  const recipients: Recipient[] = Array.from({ length: txBody.outputs().len() }, (_, i) => {
    const id = i.toString()
    const output = txBody.outputs().get(i)
    const address = output.address().to_bech32()
    const amount = output.amount()
    const assets = new Map()
    const multiAsset = amount.multiasset()
    if (multiAsset) {
      const keys = multiAsset.keys()
      Array.from({ length: keys.len() }, (_, i) => {
        const policyId = keys.get(i)
        const policyIdHex = toHex(policyId)
        const _asset = multiAsset.get(policyId)
        _asset && Array.from({ length: _asset.keys().len() }, (_, i) => {
          const assetName = _asset.keys().get(i)
          const assetNameHex = toHex(assetName.name())
          const quantity = BigInt(multiAsset.get_asset(policyId, assetName).to_str())
          const id = policyIdHex + assetNameHex
          assets.set(id, (assets.get(id) || BigInt(0)) + quantity)
        })
      })
    }
    return {
      id,
      address,
      value: {
        lovelace: BigInt(amount.coin().to_str()),
        assets
      }
    }
  })

  return (
    <Panel className='p-4 space-y-2'>
      <div className='space-y-1'>
        <div className='font-semibold'>Transaction Hash</div>
        <div className='flex items-center space-x-1'>
          <span>{toHex(txHash)}</span>
          <span>
            <CardanoScanLink className='block text-sky-700 p-2' type='transaction' id={toHex(txHash)}><SearchIcon className='w-4' /></CardanoScanLink>
          </span>
        </div>
      </div>
      <div className='flex space-x-2'>
        <div className='basis-1/2 space-y-1'>
          <div className='font-semibold'>From</div>
          <ul className='space-y-1'>
            {!txInputs.isQueried && txInputs.data.map(({ txHash, index }) =>
              <li key={`${txHash}${index}`} className='p-2 border rounded-md break-all'>{txHash}#{index}</li>
            )}
          </ul>
        </div>
        <div className='basis-1/2 space-y-1'>
          <div className='font-semibold'>To</div>
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
        <DuplicateIcon className='w-4' />
      </CopyButton>
    </span>
  )
}

const NativeScriptInfoViewer: FC<{
  cardano: Cardano
  className?: string
  script: NativeScript
}> = ({ cardano, className, script }) => {
  const hash = cardano.hashScript(script)
  const treasury = useLiveQuery(async () => db.treasuries.get(hash.to_hex()), [script])

  if (!treasury) return (
    <div className='p-4 text-white bg-sky-700 rounded shadow space-y-1'>
      <div className='font-semibold'>Note</div>
      <div>
        This is an unknown treasury. You can <Link href={getTreasuryPath(script, 'edit')}><a className='underline'>save it</a></Link> by editing its info.
      </div>
    </div>
  )

  return (
    <div className={className}>
      <h1 className='font-semibold text-lg'>{treasury.name}</h1>
      <article>
        {treasury.description}
      </article>
    </div>
  )
}

const DeleteTreasuryButton: FC<{
  cardano: Cardano
  className?: string
  children: ReactNode
  script: NativeScript
}> = ({ cardano, className, children, script }) => {
  const hash = cardano.hashScript(script)
  const treasury = useLiveQuery(async () => db.treasuries.get(hash.to_hex()), [script])
  const router = useRouter()

  const deleteHandle = () => {
    db
      .treasuries
      .delete(hash.to_hex())
      .then(() => router.push(getTreasuriesPath('new')))
  }

  return (
    <button onClick={deleteHandle} className={className} disabled={!treasury}>
      {children}
    </button>
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

const submitTx = (URL: string, transaction: Transaction) => fetch(URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/cbor' },
  body: transaction.to_bytes()
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
    const promises = config.submitAPI.map((URL) => submitTx(URL, transaction))
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

const SaveTreasuryButton: FC<{
  cardano: Cardano
  className?: string
  children: ReactNode
  name: string
  description: string
  script?: NativeScript
}> = ({ cardano, name, description, script, className, children }) => {
  const router = useRouter()
  const { notify } = useContext(NotificationContext)

  if (!script) return <button className={className} disabled={true}>{children}</button>;

  const hash = cardano.hashScript(script).to_hex()

  const submitHandle = () => {
    db
      .treasuries
      .put({ hash, name, description, script: script.to_bytes(), updatedAt: new Date() }, hash)
      .then(() => router.push(getTreasuryPath(script)))
      .catch(() => notify('error', 'Failed to save'))
  }

  const isValid = name.length > 0

  return (
    <button
      disabled={!isValid}
      className={className}
      onClick={submitHandle}>
      {children}
    </button>
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

export { AddressViewer, SaveTreasuryButton, SignTxButton, SubmitTxButton, TransactionBodyViewer, NativeScriptInfoViewer, SignatureSync, CopyVkeysButton, DeleteTreasuryButton, WalletInfo, TransactionReviewButton }
