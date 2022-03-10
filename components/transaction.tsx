import { useContext, useEffect, useState } from 'react'
import { toDecimal, CurrencyInput, getADASymbol, AssetAmount, ADAAmount } from './currency'
import { getBalance, ProtocolParameters, UTxO, Value } from '../cardano/query-api'
import { Cardano, getResult, mapCardanoSet, toHex } from '../cardano/serialization-lib'
import type { Result } from '../cardano/serialization-lib'
import type { Address, NativeScript, NativeScripts, Transaction, TransactionBody, TransactionOutput, Vkeywitness } from '@emurgo/cardano-serialization-lib-browser'
import { nanoid } from 'nanoid'
import { ArrowRightIcon, CheckIcon, DuplicateIcon, XIcon } from '@heroicons/react/solid'
import Link from 'next/link'
import { ConfigContext } from '../cardano/config'
import { Panel } from './layout'
import { NextPage } from 'next'

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

const getPolicyId = (assetId: string) => assetId.slice(0, 56)
const getAssetName = (assetId: string) => assetId.slice(56)
const decodeASCII = (assetName: string): string => {
  return Buffer.from(assetName, 'hex').toString('ascii')
}

type LabeledCurrencyInputProps = {
  symbol: string
  decimal: number
  value: bigint
  max: bigint
  onChange: (_: bigint) => void
  placeholder?: string
}

const LabeledCurrencyInput = (props: LabeledCurrencyInputProps) => {
  const { decimal, value, onChange, max, symbol, placeholder } = props
  const changeHandle = (value: bigint) => {
    const min = value > max ? max : value
    onChange(min)
  }

  return (
    <label className='flex grow border rounded-md overflow-hidden'>
      <CurrencyInput
        className='p-2 block w-full outline-none'
        decimals={decimal}
        value={value}
        onChange={changeHandle}
        placeholder={placeholder} />
      <span className='p-2'>{symbol}</span>
      <button onClick={() => onChange(max)} className='bg-gray-100 px-1 group hover:space-x-1'>
        <span>Max</span>
        <span className='hidden group-hover:inline'>{toDecimal(max, decimal)}</span>
      </button>
    </label>
  )
}

const Recipient: NextPage<{
  recipient: Recipient
  budget: Value
  onChange: (recipient: Recipient) => void
}> = ({ recipient, budget, onChange }) => {

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

  return (
    <div className='p-4 space-y-2'>
      <div>
        <label className='flex block border rounded-md overflow-hidden'>
          <span className='p-2 bg-gray-200'>TO</span>
          <input
            className='p-2 block w-full outline-none'
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder='Address' />
        </label>
      </div>
      <LabeledCurrencyInput
        symbol={getADASymbol(config)}
        decimal={6}
        value={value.lovelace}
        max={value.lovelace + budget.lovelace}
        onChange={setLovelace}
        placeholder='0.000000' />
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
                onChange={onChange} />
              <button className='px-2' onClick={() => deleteAsset(id)}>
                <XIcon className='h-4 w-4' />
              </button>
            </li>
          )
        })}
      </ul>
      <div className='relative'>
        <button className='block rounded-md bg-gray-200 p-2 peer'>Add Asset</button>
        <ul className='absolute mt-1 divide-y bg-white text-sm max-h-64 rounded-md shadow overflow-y-scroll invisible z-50 peer-focus:visible hover:visible'>
          {Array.from(budget.assets)
            .filter(([id, quantity]) => !value.assets.has(id) && quantity > BigInt(0))
            .map(([id, quantity]) => (
              <li key={id}>
                <button
                  onClick={() => setAsset(id, BigInt(0))}
                  className='block w-full h-full px-1 py-2 hover:bg-slate-100'
                >
                  <div className='flex space-x-2'>
                    <span>{decodeASCII(getAssetName(id))}</span>
                    <span className='grow text-right'>{quantity.toString()}</span>
                  </div>
                  <div className='flex space-x-1'>
                    <span className='font-mono text-gray-500 text-xs'>{id.slice(0, 56)}</span>
                  </div>
                </button>
              </li>
            ))}
        </ul>
      </div>
    </div>
  )
}

const NewTransaction: NextPage<{
  cardano: Cardano
  changeAddress?: Address
  protocolParameters: ProtocolParameters
  nativeScriptSet?: NativeScripts
  utxos: UTxO[]
}> = ({ cardano, changeAddress, protocolParameters, utxos, nativeScriptSet }) => {

  const [recipients, setRecipients] = useState<Recipient[]>([newRecipient()])

  const buildTxOutput = (recipient: Recipient): Result<TransactionOutput> => {
    const { AssetName, BigNum, TransactionOutputBuilder, MultiAsset, ScriptHash } = cardano.lib
    const addressResult = cardano.parseAddress(recipient.address)

    if (!addressResult?.isOk) return {
      isOk: false,
      message: 'Invalid address'
    }

    const address = addressResult.data

    const build = (): TransactionOutput => {
      const builder = TransactionOutputBuilder
        .new()
        .with_address(address)
        .next()
      const { lovelace, assets } = recipient.value
      const value = cardano.lib.Value.new(BigNum.from_str(lovelace.toString()))
      if (assets.size > 0) {
        const multiAsset = MultiAsset.new()
        assets.forEach((quantity, id, _) => {
          const policyId = ScriptHash.from_bytes(Buffer.from(getPolicyId(id), 'hex'))
          const assetName = AssetName.new(Buffer.from(getAssetName(id), 'hex'))
          const value = BigNum.from_str(quantity.toString())
          multiAsset.set_asset(policyId, assetName, value)
        })
        value.set_multiasset(multiAsset)
      }
      return builder.with_value(value).build()
    }

    return getResult(() => build())
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
    }, getBalance(utxos))

  const buildUTxOSet = () => {
    const { Address, AssetName, BigNum, MultiAsset, ScriptHash,
      TransactionInput, TransactionHash, TransactionOutput,
      TransactionUnspentOutput, TransactionUnspentOutputs } = cardano.lib

    const utxosSet = TransactionUnspentOutputs.new()
    utxos.forEach((utxo) => {
      const { txHash, index, lovelace, assets } = utxo
      const value = cardano.lib.Value.new(BigNum.from_str(lovelace.toString()))
      const address = Address.from_bech32(utxo.address)
      if (assets.length > 0) {
        const multiAsset = MultiAsset.new()
        assets.forEach((asset) => {
          const policyId = ScriptHash.from_bytes(Buffer.from(asset.policyId, 'hex'))
          const assetName = AssetName.new(Buffer.from(asset.assetName, 'hex'))
          const quantity = BigNum.from_str(asset.quantity.toString())
          multiAsset.set_asset(policyId, assetName, quantity)
        })
        value.set_multiasset(multiAsset)
      }
      const txUnspentOutput = TransactionUnspentOutput.new(
        TransactionInput.new(TransactionHash.from_bytes(Buffer.from(txHash, 'hex')), index),
        TransactionOutput.new(address, value)
      )
      utxosSet.add(txUnspentOutput)
    })

    return utxosSet
  }

  const transactionResult = getResult(() => {
    const txBuilder = cardano.createTxBuilder(protocolParameters)
    const { Address, Transaction, TransactionWitnessSet } = cardano.lib

    txOutputResults.forEach((txOutputResult) => {
      if (!txOutputResult?.isOk) throw new Error('There are some invalid Transaction Outputs')
      txBuilder.add_output(txOutputResult.data)
    })

    const address = changeAddress ? changeAddress : Address.from_bech32(utxos[0].address)
    cardano.chainCoinSelection(txBuilder, buildUTxOSet(), address)

    const txBody = txBuilder.build()
    const witnessSet = TransactionWitnessSet.new()
    nativeScriptSet && witnessSet.set_native_scripts(nativeScriptSet)

    return Transaction.new(txBody, witnessSet)
  })

  const handleRecipientChange = (recipient: Recipient) => {
    setRecipients(recipients.map((_recipient) => _recipient.id === recipient.id ? recipient : _recipient))
  }

  const deleteRecipient = (recipient: Recipient) => {
    setRecipients(recipients.filter(({ id }) => id !== recipient.id))
  }

  const base64Transaction = transactionResult.isOk && Buffer.from(transactionResult.data.to_bytes()).toString('base64')

  return (
    <Panel title='New Transaction'>
      {!transactionResult.isOk && (
        <p className='p-2 text-center text-red-600 bg-red-200'>{transactionResult.message}</p>
      )}
      <ul className='divide-y'>
        {recipients.map((recipient, index) =>
          <li key={recipient.id}>
            <header className='flex px-4 py-2 bg-gray-100'>
              <h2 className='grow font-bold'>Recipient #{index + 1}</h2>
              <nav className='flex justify-between items-center'>
                {recipients.length > 1 &&
                  <button onClick={() => deleteRecipient(recipient)}>
                    <XIcon className='h-4 w-4' />
                  </button>
                }
              </nav>
            </header>
            <Recipient recipient={recipient} budget={budget} onChange={handleRecipientChange} />
          </li>
        )}
      </ul>
      <footer className='flex px-4 py-2 bg-gray-100 items-center'>
        <div className='grow'>
          {transactionResult.isOk &&
            <p className='flex space-x-1 font-bold'>
              <span>Fee:</span>
              <span><ADAAmount lovelace={BigInt(transactionResult.data.body().fee().to_str())} /></span>
            </p>
          }
        </div>
        <nav className='flex space-x-2'>
          <button
            className='p-2 rounded-md bg-blue-200'
            onClick={() => setRecipients(recipients.concat(newRecipient()))}>
            Add Recipient
          </button>
          {base64Transaction &&
            <Link href={`/transactions/${encodeURIComponent(base64Transaction)}`}>
              <a className='p-2 rounded-md bg-blue-200'>Review</a>
            </Link>
          }
        </nav>
      </footer>
    </Panel>
  )
}

const TransactionBodyViewer: NextPage<{ txBody: TransactionBody }> = ({ txBody }) => {
  const fee = BigInt(txBody.fee().to_str())
  type TxInputSet = { isQueried: false, data: { txHash: string, index: number }[] }
  const txInputs: TxInputSet = {
    isQueried: false,
    data: Array.from({ length: txBody.inputs().len() }, (_, i) => {
      const input = txBody.inputs().get(i)
      return {
        txHash: toHex(input.transaction_id()),
        index: input.index()
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
          const assetNameHex = Buffer.from(assetName.name()).toString('hex')
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
    <Panel title='Proposal'>
      <div className='p-4'>
        <div className='flex items-center'>
          <ul className='basis-[47.5%] space-y-1'>
            {!txInputs.isQueried && txInputs.data.map(({ txHash, index }) =>
              <li key={`${txHash}${index}`} className='p-2 border rounded-md break-all'>{txHash}#{index}</li>
            )}
          </ul>
          <div className='basis-[5%] flex justify-center'>
            <ArrowRightIcon className='h-10 w-10' />
          </div>
          <ul className='basis-[47.5%] space-y-1'>
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

const SignTxButton: NextPage<{
  className?: string,
  transaction: Transaction,
  partialSign: boolean,
  signHandle: (_: string) => void,
  wallet: 'ccvault' | 'nami' | 'gero' | 'flint'
}> = (props) => {

  type WalletAPI = {
    signTx(tx: string, partialSign: boolean): Promise<string>
  }

  const [run, setRun] = useState(false)

  useEffect(() => {
    let isMounted = true;

    const chooseWallet = () => {
      const cardano = (window as any).cardano
      switch (props.wallet) {
        case 'ccvault': return cardano?.ccvault
        case 'nami': return cardano?.nami
        case 'gero': return cardano?.gerowallet
        case 'flint': return cardano?.flint
      }
    }
    const enableWallet = (): Promise<WalletAPI> => chooseWallet()?.enable()

    run && enableWallet()
      .then((walletAPI: WalletAPI) => {
        const hex = toHex(props.transaction)
        walletAPI
          .signTx(hex, props.partialSign)
          .then(props.signHandle)
          .catch((error) => console.error(error))
      })
      .catch((error) => console.error(error))
      .finally(() => setRun(false))

    return () => {
      isMounted = false
    }
  }, [run])

  return <button className={props.className} onClick={() => setRun(true)}>{props.children}</button>
}

const CopyToClipboardButton: NextPage<{
  className?: string
  content: string
}> = ({ className, content, children }) => {

  const clickHandle = () => {
    navigator.clipboard.writeText(content)
  }

  return (
    <button
      onClick={clickHandle}
      className={className}>
      {children}
    </button>
  )
}

const NativeScriptViewer: NextPage<{
  cardano: Cardano
  script: NativeScript
  signatures?: Map<string, Vkeywitness>
}> = ({ cardano, script, signatures }) => {

  const [config, _] = useContext(ConfigContext)
  const address = cardano.getScriptAddress(script, config.isMainnet)
  const requireSignatures = cardano.getRequiredSignatures(script)

  return (
    <Panel title='Native Script'>
      <div className='p-4 text-center font-mono'>
        <h3 className='mb-2'>{address.to_bech32()}</h3>
        <p className='text-center m-2'>{`${requireSignatures} signatures required`}</p>
        <ul className='text-gray-500'>
          {mapCardanoSet(script.get_required_signers(), (keyHash, index) => {
            const signature = signatures?.get(toHex(keyHash))
            const hex = signature && cardano.buildSingleSignatureHex(signature)
            return (
              <li key={index} className={signature ? 'text-green-500' : ''}>
                <span>{toHex(keyHash)}</span>
                {signature && <span><CheckIcon className='h-6 w-6 inline' /></span>}
                {hex && <CopyToClipboardButton content={hex}><DuplicateIcon className='h-6 w-6 inline' /></CopyToClipboardButton>}
              </li>
            )
          })}
        </ul>
      </div>
    </Panel>
  )
}

const SubmitTxButton: NextPage<{
  className?: string
  transaction: Transaction
}> = ({ className, children, transaction }) => {
  type WalletAPI = {
    submitTx(tx: string): Promise<string>
  }

  const [config, _] = useContext(ConfigContext)
  const [run, setRun] = useState(false)
  const { submitAPI } = config

  useEffect(() => {
    let isMounted = true;

    if (run && submitAPI.type == 'wallet') {
      const cardano = (window as any).cardano
      const wallet = cardano?.nami || cardano?.ccvault || cardano?.gerowallet

      if (!wallet) throw new Error('No wallet was found')

      const walletAPI: Promise<WalletAPI> = wallet.enable()
      walletAPI.then((api) => {
        api.submitTx(toHex(transaction))
          .then((response) => console.log(response))
          .catch((reason) => console.log(reason))
      })
        .catch((reason) => console.log(reason))
        .finally(() => setRun(false))
    }

    return () => {
      isMounted = false
    }
  }, [run])
  return (
    <button onClick={() => setRun(true)} className={className}>{children}</button>
  )
}

export { SignTxButton, SubmitTxButton, TransactionBodyViewer, NativeScriptViewer, NewTransaction }
