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

const LabeledCurrencyInput = (
  symbol: string,
  decimal: number,
  value: bigint,
  max: bigint,
  onChange: (_: bigint) => void,
  placeholder?: string
) => {
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
      <button>of&nbsp;{toDecimal(max, decimal)}</button>
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
      <div key={index} className='p-4 my-2 rounded-md bg-white space-y-2'>
        <label className='flex block border rounded-md overflow-hidden'>
          <span className='p-2 bg-gray-200'>TO</span>
          <input
            className='p-2 block w-full outline-none'
            value={address}
            onChange={(e) => setRecipient({ ...recipient, address: e.target.value })}
            placeholder='Address' />
        </label>
        {LabeledCurrencyInput('₳', 6, lovelace, balance.lovelace, setLovelace, '0.000000')}
        {Array.from(assets).map(([id, quantity]) => {
          const symbol = getAssetName(id.slice(56))
          const max = balance.assets.get(id)
          const onChange = (value: bigint) => setAsset(id, value)
          return max && LabeledCurrencyInput(symbol, 0, quantity, max, onChange)
        })}
        <div className='relative'>
          <button className='block rounded-md bg-gray-200 p-2 peer'>Add Asset</button>
          <ul className='absolute mt-1 divide-y bg-white text-sm max-h-64 rounded-md shadow overflow-y-scroll invisible peer-focus:visible hover:visible'>
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
    <div>
      {recipients.map((recipient, index) => Recipient(recipient, index, balance))}
      <div className='p-4 rounded-md bg-white my-2'>
        <button
          className='p-2 rounded-md bg-gray-200'
          onClick={() => setRecipients(recipients.concat(defaultRecipient))}
        >
          Add Recipient
        </button>
      </div>
    </div>
  )
}

export type { Assets, Balance }
export { NewTransaction }
