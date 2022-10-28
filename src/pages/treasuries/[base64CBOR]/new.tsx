import type { NextPage } from 'next'
import type { FC } from 'react'
import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import { BackButton, Hero, Layout, Panel } from '../../../components/layout'
import { Cardano, isAddressNetworkCorrect, newRecipient, Recipient } from '../../../cardano/multiplatform-lib'
import { getResult, useCardanoMultiplatformLib } from '../../../cardano/multiplatform-lib'
import { ErrorMessage, Loading } from '../../../components/status'
import type { ChangeEventHandler } from 'react'
import { useContext, useMemo, useState } from 'react'
import { ConfigContext } from '../../../cardano/config'
import { NativeScriptInfoViewer, TransactionReviewButton } from '../../../components/transaction'
import { decodeASCII, getAssetName, getBalanceByUTxOs, getPolicyId, useGetUTxOsToSpendQuery } from '../../../cardano/query-api'
import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import type { Value } from '../../../cardano/query-api'
import type { ProtocolParams, TransactionOutput } from '@cardano-graphql/client-ts'
import { PlusIcon, TrashIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { ADAAmount, getADASymbol, LabeledCurrencyInput } from '../../../components/currency'
import { suggestExpirySlot, suggestStartSlot } from '../../../components/native-script'
import type { Output } from 'cardano-utxo-wasm'
import init, { select } from 'cardano-utxo-wasm'

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
  protocolParameters: ProtocolParams
  nativeScript: NativeScript
  utxos: TransactionOutput[]
  minLovelace: bigint
}> = ({ cardano, protocolParameters, nativeScript, utxos, minLovelace }) => {
  const [recipients, setRecipients] = useState<Recipient[]>([newRecipient()])
  const [message, setMessage] = useState<string[]>([])
  const [config, _] = useContext(ConfigContext)
  const [inputs, setInputs] = useState<Output[]>([])
  const [changeAddress, setChangeAddress] = useState<string>(cardano.getScriptAddress(nativeScript, config.isMainnet).to_bech32())
  const [isChangeSettingDisabled, setIsChangeSettingDisabled] = useState(true)

  useEffect(() => {
    let isMounted = true

    if (isMounted) {
      setInputs([])
      init().then(() => {
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
        const result = select(inputs, outputs, { lovelace: minLovelace, assets: [] })
        result && setInputs(result.selected)
      })
    }

    return () => {
      isMounted = false
    }
  }, [utxos, recipients, minLovelace])

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
    const { AuxiliaryData, ChangeSelectionAlgo, NativeScriptWitnessInfo, MetadataJsonSchema } = cardano.lib
    const txBuilder = cardano.createTxBuilder(protocolParameters)

    inputs.forEach((input) => {
      const txOutput: TransactionOutput = input.data
      const result = cardano
        .createTxInputBuilder(input, txOutput.address)
        .native_script(nativeScript, NativeScriptWitnessInfo.assume_signature_count())
      txBuilder.add_input(result)
    })

    recipients.forEach((recipient) => {
      const result = cardano.buildTxOutput(recipient, protocolParameters)
      txBuilder.add_output(result)
    })

    if (message.length > 0) {
      const value = JSON.stringify({
        msg: message
      })
      let auxiliaryData = AuxiliaryData.new()
      auxiliaryData.add_json_metadatum_with_schema(cardano.getMessageLabel(), value, MetadataJsonSchema.NoConversions)
      txBuilder.add_auxiliary_data(auxiliaryData)
    }

    const startSlot = suggestStartSlot(nativeScript)
    if (startSlot) {
      txBuilder.set_validity_start_interval(startSlot)
    }

    const expirySlot = suggestExpirySlot(nativeScript)
    if (expirySlot) {
      txBuilder.set_ttl(expirySlot)
    }

    return txBuilder.build(ChangeSelectionAlgo.Default, cardano.parseAddress(changeAddress)).build_unchecked()
  }), [recipients, cardano, config, message, protocolParameters, inputs, nativeScript])

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
                    <XMarkIcon className='w-4' />
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
          <h2 className='font-semibold'>Change Address</h2>
          <p className='text-sm'>Send change to this address. Default to the treasury address. DO NOT CHANGE IT UNLESS YOU KNOW WHAT YOU ARE DOING!</p>
          <label className='text-sm items-center space-x-1'>
            <input
              type='checkbox'
              checked={!isChangeSettingDisabled}
              onChange={() => setIsChangeSettingDisabled(!isChangeSettingDisabled)} />
            <span>I know the risk and I want to change it.</span>
          </label>
        </header>
        <RecipientAddressInput
          className='p-4'
          cardano={cardano}
          disabled={isChangeSettingDisabled}
          address={changeAddress}
          setAddress={setChangeAddress} />
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
          <BackButton className='p-2 rounded text-sky-700 border'>Back</BackButton>
          <button
            className='p-2 rounded text-sky-700 border'
            onClick={() => setRecipients(recipients.concat(newRecipient()))}>
            Add Recipient
          </button>
          {txResult.isOk && <TransactionReviewButton className='px-4 py-2 rounded' transaction={txResult.data} />}
        </nav>
      </footer>
    </Panel>
  )
}

const GetUTxOsToSpend: FC<{
  cardano: Cardano
  script: NativeScript
}> = ({ cardano, script }) => {
  const minLovelace = BigInt(5e6)
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
        <Hero>
          <h1 className='font-semibold text-lg'>Create Transaction</h1>
          <p>Due to the native assets, you should have <strong><ADAAmount lovelace={minLovelace} /></strong> at least in your treasury in order to create transactions properly.</p>
        </Hero>
        <NativeScriptInfoViewer
          className='border-t-4 border-sky-700 bg-white rounded shadow overflow-hidden p-4 space-y-1'
          script={script} />
        <NewTransaction
          cardano={cardano}
          minLovelace={minLovelace}
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
