import { ChangeEventHandler, MouseEventHandler, useContext, useEffect, useState } from 'react'
import { toDecimal, CurrencyInput, getADASymbol, AssetAmount, ADAAmount } from './currency'
import { getAssetName, getBalanceByUTxOs, Value } from '../cardano/query-api'
import { Cardano, getResult, toHex, toIter } from '../cardano/multiplatform-lib'
import type { Result } from '../cardano/multiplatform-lib'
import type { TransactionOutput as GraphQLTransactionOutput } from '@cardano-graphql/client-ts'
import type { Address, NativeScript, NativeScripts, Transaction, TransactionBody, TransactionHash, TransactionOutput, Vkeywitness } from '@dcspark/cardano-multiplatform-lib-browser'
import { nanoid } from 'nanoid'
import { CheckIcon, DuplicateIcon, PlusIcon, SearchIcon, TrashIcon, XIcon } from '@heroicons/react/solid'
import Link from 'next/link'
import { Config, ConfigContext } from '../cardano/config'
import { BackButton, CardanoScanLink, CopyButton, Panel, Toggle } from './layout'
import { NextPage } from 'next'
import { NotificationContext } from './notification'
import Image from 'next/image'
import { db } from '../db'
import Gun from 'gun'
import type { IGunInstance } from 'gun'
import { useRouter } from 'next/router'
import { useLiveQuery } from 'dexie-react-hooks'
import { getTransactionPath, getTreasuriesPath, getTreasuryPath } from '../route'
import { ShelleyProtocolParams } from '@cardano-graphql/client-ts'

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

const decodeASCII = (assetName: string): string => {
  return Buffer.from(assetName, 'hex').toString('ascii')
}

const LabeledCurrencyInput: NextPage<{
  symbol: string
  decimal: number
  value: bigint
  min?: bigint
  max: bigint
  maxButton?: boolean
  onChange: (_: bigint) => void
  placeholder?: string
}> = (props) => {
  const { decimal, value, onChange, min, max, maxButton, symbol, placeholder } = props
  const changeHandle = (value: bigint) => {
    const min = value > max ? max : value
    onChange(min)
  }
  const isValid = value > 0 && value <= max && (min ? value >= min : true)

  return (
    <label className='flex grow border rounded overflow-hidden'>
      <CurrencyInput
        className={['p-2 block w-full outline-none', isValid ? '' : 'text-red-500'].join(' ')}
        decimals={decimal}
        value={value}
        onChange={changeHandle}
        placeholder={placeholder} />
      <div className='p-2 space-x-1'>
        <span>of</span>
        <span>{toDecimal(max, decimal)}</span>
        <span>{symbol}</span>
      </div>
      {maxButton &&
        <button
          onClick={() => onChange(max)}
          className='bg-gray-100 border-l py-2 px-4 group text-sky-700'>
          Max
        </button>
      }
    </label>
  )
}

const AddAssetButton: NextPage<{
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

const isAddressNetworkCorrect = (config: Config, address: Address): boolean => {
  const networkId = address.network_id()
  return config.isMainnet ? networkId === 1 : networkId === 0
}

const Recipient: NextPage<{
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

  const minLovelace = getMinLovelace(recipient)
  const addressResult = getResult(() => {
    const addressObject = cardano.lib.Address.from_bech32(address)
    if (!isAddressNetworkCorrect(config, addressObject)) throw new Error('This address is from a wrong network')
    return addressObject
  })

  return (
    <div className='p-4 space-y-2'>
      <div>
        <label className='flex block border rounded overflow-hidden'>
          <span className='p-2 bg-gray-100 border-r'>To</span>
          <input
            className={['p-2 block w-full outline-none', addressResult.isOk ? '' : 'text-red-500'].join(' ')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder='Address' />
        </label>
        {!addressResult.isOk && <p className='text-sm'>{addressResult.message}</p>}
      </div>
      <div>
        <LabeledCurrencyInput
          symbol={getADASymbol(config)}
          decimal={6}
          value={value.lovelace}
          min={minLovelace}
          max={value.lovelace + budget.lovelace}
          onChange={setLovelace}
          placeholder='0.000000' />
        <p className='text-sm space-x-1'>
          <span>At least</span>
          <button
            onClick={() => setLovelace(minLovelace)}
            className='text-sky-700 font-semibold'>
            <ADAAmount lovelace={minLovelace} />
          </button>
          <span>is required</span>
        </p>
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
                <TrashIcon className='w-4' />
              </button>
            </li>
          )
        })}
      </ul>
      <AddAssetButton budget={budget} value={value} onSelect={(id) => setAsset(id, BigInt(0))} />
    </div>
  )
}

const TransactionMessageInput: NextPage<{
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

const NewTransaction: NextPage<{
  cardano: Cardano
  changeAddress?: Address
  protocolParameters: ShelleyProtocolParams
  nativeScriptSet?: NativeScripts
  utxos: GraphQLTransactionOutput[]
}> = ({ cardano, changeAddress, protocolParameters, utxos, nativeScriptSet }) => {
  const txBuilder = cardano.createTxBuilder(protocolParameters)
  const [recipients, setRecipients] = useState<Recipient[]>([newRecipient()])
  const [message, setMessage] = useState<string[]>([])
  const [config, _] = useContext(ConfigContext)

  const getMinLovelace = (recipient: Recipient): bigint => {
    const coinsPerUtxoWord = protocolParameters.coinsPerUtxoWord
    if (!coinsPerUtxoWord) throw new Error('No coinsPerUtxoWord')
    return cardano.getMinLovelace(recipient.value, false, coinsPerUtxoWord)
  }

  const buildTxOutput = (recipient: Recipient): Result<TransactionOutput> => {
    const { TransactionOutputBuilder } = cardano.lib
    return getResult(() => {
      const address = cardano.lib.Address.from_bech32(recipient.address)
      if (!isAddressNetworkCorrect(config, address)) throw new Error('Wrong network')
      const builder = TransactionOutputBuilder
        .new()
        .with_address(address)
        .next()
      const value = cardano.getCardanoValue(recipient.value)
      return builder.with_value(value).build()
    })
  }

  const txOutputResults = recipients.map(buildTxOutput)

  const budget: Value = recipients
    .map(({ value }) => value)
    .reduce((result, value) => {
      const lovelace = result.lovelace - value.lovelace
      const assets = new Map(result.assets)
      Array.from(value.assets).forEach(([id, quantity]) => {
        const _quantity = assets.get(id)
        _quantity && assets.set(id, _quantity - quantity)
      })
      return { lovelace, assets }
    }, getBalanceByUTxOs(utxos))

  const buildUTxOSet = () => {
    const { Address, AssetName, BigNum, MultiAsset, ScriptHash,
      TransactionInput, TransactionHash, TransactionOutput,
      TransactionUnspentOutput, TransactionUnspentOutputs } = cardano.lib

    const utxosSet = TransactionUnspentOutputs.new()
    utxos.forEach((utxo) => {
      const value = cardano.lib.Value.new(BigNum.from_str(utxo.value.toString()))
      const address = Address.from_bech32(utxo.address)
      if (utxo.tokens.length > 0) {
        const multiAsset = MultiAsset.new()
        utxo.tokens.forEach((token) => {
          const asset = token.asset
          const policyId = ScriptHash.from_bytes(Buffer.from(asset.policyId, 'hex'))
          const assetName = AssetName.new(Buffer.from(asset.assetName, 'hex'))
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

  const transactionResult = getResult(() => {
    const { Address } = cardano.lib

    txOutputResults.forEach((txOutputResult) => {
      if (!txOutputResult?.isOk) throw new Error('There are some invalid Transaction Outputs')
      txBuilder.add_output(txOutputResult.data)
    })

    if (nativeScriptSet) {
      txBuilder.set_native_scripts(nativeScriptSet)
    }

    if (message.length > 0) {
      const value = JSON.stringify({
        msg: message
      })
      txBuilder.add_json_metadatum(cardano.getMessageLabel(), value)
    }

    const address = changeAddress ? changeAddress : Address.from_bech32(utxos[0].address)
    cardano.chainCoinSelection(txBuilder, buildUTxOSet(), address)

    return txBuilder.build_tx()
  })

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
            <header className='flex px-4 py-2 bg-gray-100'>
              <h2 className='grow font-semibold'>Recipient #{index + 1}</h2>
              <nav className='flex justify-between items-center'>
                {recipients.length > 1 &&
                  <button onClick={() => deleteRecipient(recipient)}>
                    <XIcon className='w-4' />
                  </button>
                }
              </nav>
            </header>
            <Recipient
              cardano={cardano}
              recipient={recipient}
              budget={budget}
              getMinLovelace={getMinLovelace}
              onChange={handleRecipientChange} />
          </li>
        )}
      </ul>
      <div>
        <header className='px-4 py-2 bg-gray-100'>
          <h2 className='font-semibold'>Message</h2>
          <p className='text-sm'>Cannot exceed 64 bytes each line</p>
        </header>
        <TransactionMessageInput
          className='p-4 block w-full outline-none'
          onChange={setMessage}
          messageLines={message} />
      </div>
      <footer className='flex p-4 bg-gray-100 items-center'>
        <div className='grow'>
          {transactionResult.isOk &&
            <p className='flex space-x-1 font-semibold'>
              <span>Fee:</span>
              <span><ADAAmount lovelace={BigInt(transactionResult.data.body().fee().to_str())} /></span>
            </p>
          }
        </div>
        <nav className='flex justify-end space-x-2'>
          <BackButton className='p-2 rounded text-sky-700 border'>Back</BackButton>
          <button
            className='p-2 rounded text-sky-700 border'
            onClick={() => setRecipients(recipients.concat(newRecipient()))}>
            Add Recipient
          </button>
          <TransactionReviewButton className='px-4 py-2 rounded' result={transactionResult} />
        </nav>
      </footer>
    </Panel>
  )
}

const TransactionReviewButton: NextPage<{
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

const TransactionBodyViewer: NextPage<{
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
      id: nanoid(),
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

const AddressViewer: NextPage<{
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

const NativeScriptInfoViewer: NextPage<{
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

const DeleteTreasuryButton: NextPage<{
  cardano: Cardano
  className?: string
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

const NativeScriptViewer: NextPage<{
  cardano: Cardano
  className?: string
  script: NativeScript
  signatures?: Map<string, Vkeywitness>
}> = ({ cardano, className, script, signatures }) => {

  const [config, _] = useContext(ConfigContext)
  const address = cardano.getScriptAddress(script, config.isMainnet)
  const requireSignatures = cardano.getRequiredSignatures(script)

  return (
    <div className={className}>
      <div className='space-y-1'>
        <div className='font-semibold'>Treasury Address</div>
        <ul>
          <li><AddressViewer address={address} /></li>
        </ul>
      </div>
      <div className='space-y-1'>
        <div className='font-semibold'>Required Signers</div>
        <div>{requireSignatures}</div>
      </div>
      <div className='space-y-1'>
        <div className='font-semibold'>Key Hash</div>
        <ul>
          {Array.from(toIter(script.get_required_signers()), (keyHash, index) => {
            const signature = signatures?.get(toHex(keyHash))
            const hex = signature && cardano.buildSignatureSetHex([signature])
            return (
              <li key={index} className={'flex items-center ' + (signature ? 'text-green-500' : '')}>
                <span>{toHex(keyHash)}</span>
                {signature && <span><CheckIcon className='w-4' /></span>}
                {hex && <CopyButton className='text-sm' getContent={() => hex} ms={500}><DuplicateIcon className='w-4' /></CopyButton>}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
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

const WalletIcon: NextPage<{
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

const SignTxButton: NextPage<{
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

const SubmitTxButton: NextPage<{
  className?: string
  transaction: Transaction
}> = ({ className, children, transaction }) => {
  const [config, _] = useContext(ConfigContext)
  const { notify } = useContext(NotificationContext)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDisabled, setIsDisabled] = useState(false)
  const URL = config.submitAPI

  const clickHandle: MouseEventHandler<HTMLButtonElement> = () => {
    setIsSubmitting(true)
    fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/cbor' },
      body: transaction.to_bytes()
    })
      .then(async (response) => {
        if (!response.ok) {
          const message = await response.text()
          if (message.search(/\(ScriptWitnessNotValidatingUTXOW /) !== -1) {
            notify('error', 'The signatures are invalid.')
            return
          }
          if (message.search(/\(BadInputsUTxO /) !== -1) {
            notify('error', 'The UTxOs have been spent.')
            setIsDisabled(true)
            return
          }
          notify('error', 'Failed to submit.')
          return
        }
        notify('success', 'The transaction is submitted.')
      })
      .catch((reason) => {
        notify('error', 'Failed to connect.')
        console.error(reason)
      })
      .finally(() => setIsSubmitting(false))
  }

  return (
    <button onClick={clickHandle} className={className} disabled={isDisabled || isSubmitting}>
      {isSubmitting ? 'Submitting' : children}
    </button>
  )
}

const WalletInfo: NextPage<{
  className?: string
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

const SaveTreasuryButton: NextPage<{
  cardano: Cardano
  className?: string
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

const SignatureSync: NextPage<{
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

const CopyVkeysButton: NextPage<{
  cardano: Cardano
  className?: string
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

export { SaveTreasuryButton, SignTxButton, SubmitTxButton, TransactionBodyViewer, NativeScriptInfoViewer, NativeScriptViewer, NewTransaction, SignatureSync, CopyVkeysButton, DeleteTreasuryButton, WalletInfo }
