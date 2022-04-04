import type { NextPage } from 'next'
import { useState, KeyboardEventHandler, ChangeEventHandler } from 'react'
import { Hero, Layout, Panel } from '../../components/layout'
import { Result, toHex, useCardanoSerializationLib } from '../../cardano/serialization-lib'
import type { Cardano, MultiSigType } from '../../cardano/serialization-lib'
import { Loading } from '../../components/status'
import type { Address, Ed25519KeyHash } from '@adaocommunity/cardano-serialization-lib-browser'
import { PlusIcon, XIcon } from '@heroicons/react/solid'
import { SaveTreasuryButton } from '../../components/transaction'

const KeyHashLabel: NextPage<{
  cardano: Cardano
  address: string
}> = ({ address, cardano }) => {
  const parsedAddress = cardano.parseAddress(address)
  const result = parsedAddress.isOk ? cardano.getAddressKeyHash(parsedAddress.data) : parsedAddress

  const textColor = result.isOk ? 'text-gray-500' : 'text-red-500'
  const className = `${textColor}`

  if (!address) return <p className='h-4'></p>

  return (
    <p className={className}>{result.isOk ? toHex(result.data) : 'Invalid Address'}</p>
  )
}

const AddAddressButton: NextPage<{
  address: string
  cardano: Cardano
  className?: string
  onClick: (address: Address) => void
}> = ({ address, cardano, className, children, onClick }) => {
  const parseResult = cardano.parseAddress(address)
  const isDisabled = !parseResult.isOk

  const submitHandle = () => {
    parseResult.isOk && onClick(parseResult.data)
  }

  return (
    <button
      disabled={isDisabled}
      onClick={submitHandle}
      className={className}>
      {children}
    </button>
  )
}

const AddressInput: NextPage<{
  cardano: Cardano
  address: string
  onEnterPress?: (address: Address) => void
  onChange: (address: string) => void
}> = ({ address, cardano, onChange, onEnterPress }) => {
  const parsedAddress = cardano.parseAddress(address)

  const changeHandle: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    onChange(event.target.value)
  }

  const enterPressHandle: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.shiftKey == false && event.key === 'Enter') {
      event.preventDefault()
      parsedAddress.isOk && onEnterPress && onEnterPress(parsedAddress.data)
    }
  }

  const base = 'block w-full border px-4 py-2 rounded'
  const textColor = parsedAddress.isOk || (!address) ? '' : 'text-red-500'
  const className = [base, textColor].join(' ')

  return (
    <textarea
      className={className}
      onChange={changeHandle}
      onKeyDown={enterPressHandle}
      rows={1}
      value={address}
      placeholder="Add receiving address and press enter">
    </textarea>
  )
}

const AddAddress: NextPage<{
  cardano: Cardano
  onAdd: (address: string) => void
}> = ({ cardano, onAdd }) => {
  const [address, setAddress] = useState('')

  const submitHandle = (address: Address) => {
    onAdd(address.to_bech32())
    setAddress('')
  }

  return (
    <label className='block space-y-1'>
      <div>New Signer</div>
      <div className='flex space-x-2 items-center'>
        <AddressInput
          cardano={cardano}
          onChange={setAddress}
          onEnterPress={submitHandle}
          address={address} />
        <AddAddressButton
          className='flex p-2 items-center space-x-1 border rounded text-sky-700 disabled:text-gray-400'
          address={address}
          onClick={submitHandle}
          cardano={cardano}>
          <PlusIcon className='h-4' />
          <span>Add</span>
        </AddAddressButton>
      </div>
    </label>
  )
}

const NewTreasury: NextPage = () => {
  const [addresses, setAddresses] = useState<Set<string>>(new Set())
  const [scriptType, setScriptType] = useState<MultiSigType>('all')
  const [required, setRequired] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const cardano = useCardanoSerializationLib()
  if (!cardano) return <Loading />;

  const keyHashesResult: Result<Ed25519KeyHash[]> = Array
    .from(addresses)
    .map((address) => {
      const result = cardano.parseAddress(address)
      return result.isOk ? cardano.getAddressKeyHash(result.data) : result
    })
    .reduce((acc: Result<Ed25519KeyHash[]>, c: Result<Ed25519KeyHash>): Result<Ed25519KeyHash[]> => {
      if (!acc.isOk) return acc
      if (c.isOk) {
        return { isOk: true, data: acc.data.concat(c.data) }
      } else {
        return { isOk: false, message: 'Invalid address included' }
      }
    }, { isOk: true, data: new Array<Ed25519KeyHash>() })

  const script = addresses.size > 1 && keyHashesResult.isOk ? cardano.buildMultiSigScript(keyHashesResult.data, scriptType, required) : undefined

  const addAddress = (address: string) => {
    setAddresses(new Set(addresses).add(address))
  }

  const deleteAddress = (address: string) => {
    const set = new Set(addresses)
    set.delete(address)
    setAddresses(set)
  }

  return (
    <Layout>
      <div className='space-y-2'>
        <Hero>
          <h1 className='font-semibold text-lg'>New Treasury</h1>
          <p>Start to create a treasury protected by Multi-Sig native scripts from here. A treasury needs more than one address. Only receiving address should be used.</p>
        </Hero>
        <Panel>
          <div className='p-4 space-y-4'>
            <label className='block space-y-1'>
              <div>Name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className='p-2 block border w-full rounded'
                placeholder='Write Name' />
            </label>
            <label className='block space-y-1'>
              <div>Description</div>
              <textarea
                className='p-2 block border w-full rounded'
                placeholder='Describe the treasury'
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}>
              </textarea>
            </label>
            {addresses.size > 0 &&
              <div className='space-y-1'>
                <div>Signers</div>
                <ul className='border divide-y rounded'>
                  {Array.from(addresses).map((address) => {
                    return (
                      <li key={address} className='flex items-center p-2'>
                        <div className='grow'>
                          <p>{address}</p>
                          <KeyHashLabel cardano={cardano} address={address} />
                        </div>
                        <button className='p-2'>
                          <XIcon className='w-4' onClick={() => deleteAddress(address)} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>}
            {addresses.size > 1 &&
              <div className='space-y-1'>
                <div>Policy</div>
                <div className='flex space-x-2 items-center'>
                  <select className='bg-white border rounded p-2' onChange={(e) => setScriptType(e.target.value as MultiSigType)}>
                    <option value="all">All</option>
                    <option value="any">Any</option>
                    <option value="atLeast">At least</option>
                  </select>
                  {scriptType == 'atLeast' &&
                    <input type='number'
                      className='border rounded p-1'
                      value={required}
                      step={1}
                      min={1}
                      max={addresses.size}
                      onChange={(e) => setRequired(parseInt(e.target.value))} />
                  }
                  <div className='p-2'>of&nbsp;{addresses.size}</div>
                </div>
              </div>}
            <hr />
            <AddAddress cardano={cardano} onAdd={addAddress} />
          </div>
          <footer className='flex justify-end p-4 bg-gray-100'>
            <SaveTreasuryButton
              className='px-4 py-2 bg-sky-700 text-white rounded shadow disabled:text-gray-400 disabled:bg-transparent'
              name={name}
              description={description}
              script={script}>
              Save Treasury
            </SaveTreasuryButton>
          </footer>
        </Panel>
      </div>
    </Layout>
  )
}

export default NewTreasury
