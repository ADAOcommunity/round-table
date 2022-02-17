import type { NextPage } from 'next'
import { useEffect, useState, ChangeEvent } from 'react'
import Layout from '../../components/layout'
import { CardanoSerializationLib } from '../../cardano/serialization-lib'
import type { Cardano } from '../../cardano/serialization-lib'
import { Buffer } from 'buffer'

const NewScript: NextPage = () => {
  const [addresses, setAddresses] = useState<Set<string>>(new Set())
  const [cardano, setCardano] = useState<Cardano | undefined>(undefined)

  useEffect(() => {
    let mounted = true

    CardanoSerializationLib.load().then((instance) => {
      mounted && setCardano(instance)
    })

    return () => {
      mounted = false
    }
  }, [])

  const onAddAddress = (address: string) => {
    const state = new Set(addresses)
    if (address.length > 0) {
      state.add(address)
    }
    setAddresses(state)
  }

  return (
    <Layout>
      {cardano && <AddAddress cardano={cardano} onAdd={onAddAddress} />}
      {cardano && addresses.size > 0 && <Result addresses={addresses} cardano={cardano} />}
    </Layout>
  )
}

const toHex = (input: ArrayBuffer) => Buffer.from(input).toString("hex")
const getKeyHash = (cardano: Cardano, address: string): string => {
  const bytes = cardano.getBech32AddressKeyHash(address).to_bytes()
  return toHex(bytes)
}

type ResultProps = {
  addresses: Set<string>
  cardano: Cardano
}

function Result({ addresses, cardano }: ResultProps) {
  return (
    <div>
      <div className='shadow rounded-md mb-2'>
        <div className='px-3 py-1 border-b'>
          <div className='rounded-sm'>
            <select className='px-2 py-1 text-sm rounded-sm w-20'>
              <option value="all">All</option>
            </select>
          </div>
        </div>
        <ul className='divide-y'>
          {Array.from(addresses, (address) => (
            <li className='px-2 py-1' key={address}>
              <p>{address}</p>
              <p className='text-sm text-gray-400'>{getKeyHash(cardano, address)}</p>
            </li>
          ))}
        </ul>
      </div>
    </div >
  )
}

type AddAddressProps = {
  cardano: Cardano
  onAdd: (value: string) => void
}

function AddAddress({ cardano, onAdd }: AddAddressProps) {
  const [value, setValue] = useState('')
  const [keyHash, setKeyHash] = useState('')
  const [isError, setError] = useState(false)

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const address = event.target.value.trim()
    setError(false)
    setValue(address)
    try {
      setKeyHash(getKeyHash(cardano, address))
    } catch {
      setError(true)
    }
  }
  const onClick = () => {
    if (!isError) {
      onAdd(value)
    }
    setValue('')
    setKeyHash('')
  }

  return (
    <div className='shadow mb-2'>
      <div className='px-4 py-5 bg-white sm:p-6'>
        <textarea className='shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full border border-gray-300 rounded-md p-2' onChange={onChange} rows={5} value={value} placeholder="Address"></textarea>
        {isError && <p className='text-sm py-1 text-red-400'>Invalid address</p>}
        {!isError && <p className='text-sm py-1 text-gray-400'>{keyHash}</p>}
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
