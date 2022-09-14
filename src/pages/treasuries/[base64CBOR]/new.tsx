import type { NextPage } from 'next'
import type { FC } from 'react'
import { useRouter } from 'next/router'
import { BackButton, Layout, Panel } from '../../../components/layout'
import { Cardano, isAddressNetworkCorrect, newRecipient, Recipient } from '../../../cardano/multiplatform-lib'
import { getResult, useCardanoMultiplatformLib } from '../../../cardano/multiplatform-lib'
import { ErrorMessage, Loading } from '../../../components/status'
import type { ChangeEventHandler } from 'react'
import { useContext, useMemo, useState } from 'react'
import { ConfigContext } from '../../../cardano/config'
import { NativeScriptInfoViewer, TransactionReviewButton } from '../../../components/transaction'
import { decodeASCII, getAssetName, getBalanceByUTxOs, useGetUTxOsToSpendQuery } from '../../../cardano/query-api'
import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import type { Value } from '../../../cardano/query-api'
import type { ShelleyProtocolParams, TransactionOutput } from '@cardano-graphql/client-ts'
import { PlusIcon, TrashIcon, XIcon } from '@heroicons/react/solid'
import { ADAAmount, getADASymbol, LabeledCurrencyInput } from '../../../components/currency'
import { suggestExpirySlot, suggestStartSlot } from '../../../components/native-script'

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
        {address && !addressResult.isOk && <p className='text-sm'>{addressResult.message}</p>}
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
  protocolParameters: any
  nativeScript: NativeScript
  utxos: TransactionOutput[]
}> = ({ cardano, protocolParameters, nativeScript, utxos }) => {
  const [recipients, setRecipients] = useState<Recipient[]>([newRecipient()])
  const [message, setMessage] = useState<string[]>([])
  const [config, _] = useContext(ConfigContext)

  const getMinLovelace = (recipient: Recipient): bigint => {
    const coinsPerUtxoByte = protocolParameters.coinsPerUtxoByte
    if (!coinsPerUtxoByte) throw new Error('No coinsPerUtxoByte')
    return cardano.getMinLovelace(recipient.value, false, coinsPerUtxoByte)
  }

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

  const transactionResult = useMemo(() => {
    const { NativeScripts } = cardano.lib
    const txBuilder = cardano.createTxBuilder(protocolParameters)
    const nativeScripts = NativeScripts.new()
    nativeScripts.add(nativeScript)
    txBuilder.set_native_scripts(nativeScripts)

    return getResult(() => {
      recipients.forEach((recipient) => {
        const txOutputResult = cardano.buildTxOutput(recipient)
        if (!txOutputResult?.isOk) throw new Error('There are some invalid Transaction Outputs')
        txBuilder.add_output(txOutputResult.data)
      })

      if (message.length > 0) {
        const value = JSON.stringify({
          msg: message
        })
        txBuilder.add_json_metadatum(cardano.getMessageLabel(), value)
      }

      const startSlot = suggestStartSlot(nativeScript)
      if (startSlot) {
        txBuilder.set_validity_start_interval(startSlot)
      }

      const expirySlot = suggestExpirySlot(nativeScript)
      if (expirySlot) {
        txBuilder.set_ttl(expirySlot)
      }

      const address = cardano.getScriptAddress(nativeScript, config.isMainnet)
      cardano.chainCoinSelection(txBuilder, cardano.buildUTxOSet(utxos), address)

      return txBuilder.build_tx()
    })
  }, [recipients, cardano, config, message, protocolParameters, utxos, nativeScript])

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
            <TransactionRecipient
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

const GetUTxOsToSpend: FC<{
  cardano: Cardano
  script: NativeScript
}> = ({ cardano, script }) => {

  const [config, _] = useContext(ConfigContext)
  const address = cardano.getScriptAddress(script, config.isMainnet)
  const { loading, error, data } = useGetUTxOsToSpendQuery({
    variables: { addresses: [address.to_bech32()] },
    fetchPolicy: 'network-only'
  })

  if (loading) return <Loading />;
  if (error) return <ErrorMessage>An error happened when query balance.</ErrorMessage>;

  if (!data) return <Loading />;
  const protocolParameters = data.cardano.currentEpoch.protocolParams
  if (!protocolParameters) return <ErrorMessage>An error happend when query protocol parameters.</ErrorMessage>;

  return (
    <Layout>
      <div className='space-y-2'>
        <NativeScriptInfoViewer
          cardano={cardano}
          className='border-t-4 border-sky-700 bg-white rounded shadow overflow-hidden p-4 space-y-1'
          script={script} />
        <NewTransaction
          cardano={cardano}
          utxos={data.utxos}
          nativeScript={script}
          protocolParameters={protocolParameters} />
      </div>
    </Layout>
  )
}

const GetTreasury: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query
  const cardano = useCardanoMultiplatformLib()
  const parseResult = useMemo(() => {
    if (!cardano) return;
    return getResult(() => {
      if (typeof base64CBOR !== 'string') throw new Error('Invalid Script');
      return cardano.lib.NativeScript.from_bytes(Buffer.from(base64CBOR, 'base64'))
    })
  }, [cardano, base64CBOR])

  if (!cardano || !parseResult) return <Loading />;
  if (!parseResult.isOk) return <ErrorMessage>{parseResult.message}</ErrorMessage>;

  return <GetUTxOsToSpend
    cardano={cardano}
    script={parseResult.data} />
}

export default GetTreasury
