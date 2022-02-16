import type { NextPage } from 'next'
import { useState, ChangeEvent } from 'react'
import Layout from '../../components/layout'
import { CardanoSerializationLib } from '../../cardano/serialization-lib'
import type { Cardano } from '../../cardano/serialization-lib'
import { Buffer } from 'buffer'

type AddressMap = Map<string, string>

const NewScript: NextPage = () => {
  const [addresses, setAddresses] = useState<AddressMap>(new Map())
  const [cardano, setCardano] = useState<Cardano | undefined>(undefined)

  CardanoSerializationLib.load().then((instance) => setCardano(instance))

  const onAddAddress = (input: string) => {
    const bech32 = input.trim()
    const newMap = new Map(addresses)
    if (cardano && bech32.length > 0) {
      newMap.set(bech32, toHex(cardano.getBech32AddressKeyHash(bech32).to_bytes()))
    }
    setAddresses(newMap)
  }

  return (
    <Layout>
      {cardano && <AddAddress onAdd={onAddAddress} />}
      {addresses.size > 0 && <Tabs addresses={addresses} />}
    </Layout>
  )
}

const toHex = (input: ArrayBuffer) => Buffer.from(input).toString("hex")

type TabsProps = {
  addresses: AddressMap
}

function Tabs({ addresses }: TabsProps) {
  const [isInspect, setInspect] = useState(false)
  const JSONScript =
    JSON.stringify(
      { scripts: Array.from(addresses.values(), (keyHash) => ({ keyHash, type: 'sig' })), type: 'all' },
      null, 2
    )
  const code = <code>{JSONScript}</code>
  const table = (
    <table className='table-auto border-collapse text-sm'>
      <thead className='bg-gray-100'>
        <tr>
          <th className='border-b border-r p-1'>Address</th>
          <th className='border-b border-r'>Key Hash</th>
        </tr>
      </thead>
      <tbody>
        {Array.from(addresses.entries(), ([bech32, keyHash]) => (
          <tr key={bech32}>
            <td className='border-t border-r p-1'>{bech32}</td>
            <td className='border-t border-r p-1 break-all text-gray-500'>{keyHash}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div>
      <label>
        <input className='form' type="checkbox" defaultChecked={isInspect} onChange={() => setInspect(!isInspect)} />
        Show JSON
      </label>
      <div className='shadow sm:rounded-md sm:overflow-hidden mb-2'>
        {isInspect ? code : table}
      </div>
    </div >
  )
}

type AddAddressProps = {
  onAdd: (value: string) => void
}

function AddAddress({ onAdd }: AddAddressProps) {
  const [value, setValue] = useState('')
  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value)
  }
  const onClick = () => {
    onAdd(value)
    setValue('')
  }

  return (
    <div className='shadow mb-2'>
      <div className='px-4 py-5 bg-white space-y-6 sm:p-6'>
        <textarea className='shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md' onChange={onChange} rows={5} value={value}></textarea>
      </div>
      <div className='px-4 py-3 bg-gray-50 text-right sm:px-6'>
        <button className='inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700' onClick={onClick}>
          Add Address
        </button>
      </div>
    </div>
  )
}

export default NewScript
