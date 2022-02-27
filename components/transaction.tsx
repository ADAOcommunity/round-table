import { useState } from 'react'
import { toDecimal, CurrencyInput } from './currency'

type Assets = Map<string, bigint>

type TxOutput = {
  txHash: string
  index: number
}

type Value = {
  lovelace: bigint
  assets: Assets
}

type Balance = { txOutputs: TxOutput[] } & Value
type Recipient = { address: string } & Value

const defaultRecipient = {
  address: '',
  lovelace: BigInt(1e6),
  assets: new Map()
}

type NewTransactionProps = {
  balance: Balance
}

const getAssetName = (assetName: string): string => {
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
    <label className='flex block border rounded-md overflow-hidden'>
      <CurrencyInput
        className='p-2 block w-full outline-none'
        decimals={decimal}
        value={value}
        onChange={changeHandle}
        placeholder={placeholder} />
      <span className='py-2 px-1'>of</span>
      <button onClick={() => onChange(max)} className='underline'>{toDecimal(max, decimal)}</button>
      <span className='p-2'>{symbol}</span>
    </label>
  )
}

const NewTransaction = ({ balance }: NewTransactionProps) => {
  const [recipients, setRecipients] = useState<Recipient[]>([defaultRecipient])

  const Recipient = (recipient: Recipient, index: number, balance: Balance) => {
    const { address, lovelace, assets } = recipient
    const setRecipient = (newRecipient: Recipient) => {
      setRecipients(recipients.map((oldRecipient, _index) => {
        return _index === index ? newRecipient : oldRecipient
      }))
    }
    const setLovelace = (lovelace: bigint) => {
      setRecipient({ ...recipient, lovelace })
    }
    const setAsset = (id: string, quantity: bigint) => {
      setRecipient({
        address,
        lovelace,
        assets: new Map(assets).set(id, quantity)
      })
    }

    return (
      <div className='p-4 space-y-2'>
        <label className='flex block border rounded-md overflow-hidden'>
          <span className='p-2 bg-gray-200'>TO</span>
          <input
            className='p-2 block w-full outline-none'
            value={address}
            onChange={(e) => setRecipient({ ...recipient, address: e.target.value })}
            placeholder='Address' />
        </label>
        <LabeledCurrencyInput symbol='₳' decimal={6} value={lovelace} max={balance.lovelace} onChange={setLovelace} placeholder='0.000000' />
        <ul className='space-y-2'>
          {Array.from(assets).map(([id, quantity]) => {
            const symbol = getAssetName(id.slice(56))
            const max = balance.assets.get(id)
            const onChange = (value: bigint) => setAsset(id, value)
            if (max) {
              return (
                <li key={id}>
                  <LabeledCurrencyInput
                    symbol={symbol}
                    decimal={0}
                    value={quantity}
                    max={max}
                    onChange={onChange} />
                </li>
              )
            } else {
              return <li></li>
            }
          })}
        </ul>
        <div className='relative'>
          <button className='block rounded-md bg-gray-200 p-2 peer'>Add Asset</button>
          <ul className='absolute mt-1 divide-y bg-white text-sm max-h-64 rounded-md shadow overflow-y-scroll invisible z-50 peer-focus:visible hover:visible'>
            {Array.from(balance.assets)
              .filter(([id, _]) => !assets.has(id))
              .map(([id, quantity]) => (
                <li key={id}>
                  <button
                    onClick={() => setAsset(id, BigInt(0))}
                    className='block w-full h-full px-1 py-2 hover:bg-slate-100'
                  >
                    <div className='flex space-x-2'>
                      <span>{getAssetName(id.slice(56))}</span>
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

  return (
    <div className='my-2 rounded-md border bg-white overflow-hidden shadow'>
      <ul className='divide-y'>
        {recipients.map((recipient, index) => (
          <li key={index}>
            {Recipient(recipient, index, balance)}
          </li>
        ))}
      </ul>
      <footer className='p-4 bg-gray-100'>
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

export type { Assets, Balance }
export { NewTransaction }
