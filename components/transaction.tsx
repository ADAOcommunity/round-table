import { useState } from 'react'
import { toDecimal, CurrencyInput } from './currency'
import { getBalance, ProtocolParameters, UTxO, Value } from '../cardano/query-api'
import { Cardano } from '../cardano/serialization-lib'
import type { Result } from '../cardano/serialization-lib'
import type { Address, TransactionBody, TransactionOutput } from '@emurgo/cardano-serialization-lib-browser'

type Recipient = {
  address: string
  value: Value
}

const defaultRecipient: Recipient = {
  address: '',
  value: {
    lovelace: BigInt(0),
    assets: new Map()
  }
}

const getPolicyId = (assetId: string) => assetId.slice(0, 56)
const getAssetName = (assetId: string) => assetId.slice(56)

const decodeASCII = (assetName: string): string => {
  const buffer = Buffer.from(assetName, 'hex')
  const decoder = new TextDecoder('ascii')
  return decoder.decode(buffer)
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

type NewTransactionProps = {
  senderAddress: Address
  cardano: Cardano
  protocolParameters: ProtocolParameters
  utxos: UTxO[]
}

const NewTransaction = ({ senderAddress, cardano, protocolParameters, utxos }: NewTransactionProps) => {
  const [recipients, setRecipients] = useState<Recipient[]>([defaultRecipient])

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

    try {
      return {
        isOk: true,
        data: build()
      }
    } catch (error) {
      return {
        isOk: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  const txOutputResults = recipients.map(buildTxOutput)

  type RecipientProps = {
    recipient: Recipient
    index: number
    budget: Value
  }
  const Recipient = ({ recipient, index, budget }: RecipientProps) => {
    const { address, value } = recipient
    const { lovelace, assets } = value
    const setRecipient = (newRecipient: Recipient) => {
      setRecipients(recipients.map((oldRecipient, _index) => {
        return _index === index ? newRecipient : oldRecipient
      }))
    }
    const setAddress = (address: string) => {
      setRecipient({ ...recipient, address: address })
    }
    const setLovelace = (lovelace: bigint) => {
      setRecipient({ ...recipient, value: { ...value, lovelace } })
    }
    const setAsset = (id: string, quantity: bigint) => {
      setRecipient({
        ...recipient,
        value: {
          ...value,
          assets: new Map(assets).set(id, quantity)
        }
      })
    }
    const deleteAsset = (id: string) => {
      const newAssets = new Map(assets)
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
          symbol='₳'
          decimal={6}
          value={lovelace}
          max={lovelace + budget.lovelace}
          onChange={setLovelace}
          placeholder='0.000000' />
        <ul className='space-y-2'>
          {Array.from(assets).map(([id, quantity]) => {
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
                <button className='px-2 bg-gray-100 rounded-md' onClick={() => deleteAsset(id)}>Del</button>
              </li>
            )
          })}
        </ul>
        <div className='relative'>
          <button className='block rounded-md bg-gray-200 p-2 peer'>Add Asset</button>
          <ul className='absolute mt-1 divide-y bg-white text-sm max-h-64 rounded-md shadow overflow-y-scroll invisible z-50 peer-focus:visible hover:visible'>
            {Array.from(budget.assets)
              .filter(([id, quantity]) => !assets.has(id) && quantity > BigInt(0))
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
    const { AssetName, BigNum, MultiAsset, ScriptHash,
      TransactionInput, TransactionHash, TransactionOutput,
      TransactionUnspentOutput, TransactionUnspentOutputs } = cardano.lib

    const utxosSet = TransactionUnspentOutputs.new()
    utxos.forEach((utxo) => {
      const { txHash, index, lovelace, assets } = utxo
      const value = cardano.lib.Value.new(BigNum.from_str(lovelace.toString()))
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
        TransactionOutput.new(senderAddress, value)
      )
      utxosSet.add(txUnspentOutput)
    })

    return utxosSet
  }

  const buildTransaction = (): Result<TransactionBody> => {
    try {
      const txBuilder = cardano.createTxBuilder(protocolParameters)

      txOutputResults.forEach((txOutputResult) => {
        if (!txOutputResult?.isOk) throw new Error('There are some invalid Transaction Outputs')
        txBuilder.add_output(txOutputResult.data)
      })

      cardano.chainCoinSelection(txBuilder, buildUTxOSet(), senderAddress)

      return { isOk: true, data: txBuilder.build() }
    } catch (error) {
      return {
        isOk: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  const buildTxResult = buildTransaction()

  return (
    <div className='my-2 rounded-md border bg-white overflow-hidden shadow'>
      <header className='p-2 text-center bg-gray-100'>
        <h1 className='font-bold text-lg'>New Transaction</h1>
      </header>
      {!buildTxResult.isOk && (
        <p className='p-2 text-center text-red-600 bg-red-200'>{buildTxResult.message}</p>
      )}
      <ul className='divide-y'>
        {recipients.map((recipient, index) =>
          <li key={index}>
            <Recipient recipient={recipient} index={index} budget={budget} />
          </li>
        )}
      </ul>
      <footer className='flex flex-row-reverse p-2 bg-gray-100 space-x-2'>
        <button
          className='p-2 rounded-md bg-blue-200'
          onClick={() => setRecipients(recipients.concat(defaultRecipient))}
        >
          Add Recipient
        </button>
      </footer>
    </div>
  )
}

export { NewTransaction }
