import type { NextPage } from 'next'
import { useState, useContext, KeyboardEventHandler, ChangeEventHandler } from 'react'
import { Layout, Panel } from '../../components/layout'
import { Result, toHex, useCardanoSerializationLib } from '../../cardano/serialization-lib'
import type { Cardano, MultiSigType } from '../../cardano/serialization-lib'
import Link from 'next/link'
import { ConfigContext } from '../../cardano/config'
import { Loading } from '../../components/status'
import type { Address, Ed25519KeyHash } from '@adaocommunity/cardano-serialization-lib-browser'
import { PlusIcon, XIcon } from '@heroicons/react/solid'
import { SaveTreasury } from '../../components/transaction'

const KeyHashLabel: NextPage<{
  cardano: Cardano
  address: string
}> = ({ address, cardano }) => {
  const parsedAddress = cardano.parseAddress(address)
  const result = parsedAddress.isOk ? cardano.getAddressKeyHash(parsedAddress.data) : parsedAddress

  const textColor = result.isOk ? 'text-gray-500' : 'text-red-500'
  const className = `font-mono ${textColor}`

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

  const base = 'block grow p-4 outline-none font-mono'
  const textColor = parsedAddress.isOk || (!address) ? '' : 'text-red-500'
  const className = [base, textColor].join(' ')

  return (
    <textarea
      className={className}
      onChange={changeHandle}
      onKeyDown={enterPressHandle}
      rows={1}
      value={address}
      placeholder="Add receiving address">
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
    <div>
      <div className='flex'>
        <AddressInput
          cardano={cardano}
          onChange={setAddress}
          onEnterPress={submitHandle}
          address={address} />
      </div>
      <footer className='flex px-4 py-2 bg-gray-100 justify-center'>
        <AddAddressButton
          className='flex items-center space-x-1 p-2 rounded-md bg-green-100 text-green-500 disabled:bg-gray-100 disabled:text-gray-500'
          address={address}
          onClick={submitHandle}
          cardano={cardano}>
          <PlusIcon className='h-5 w-5' />
          <span>Add Address</span>
        </AddAddressButton>
      </footer>
    </div>
  )
}

const NewTreasury: NextPage = () => {
  const [config, _] = useContext(ConfigContext)
  const [addresses, setAddresses] = useState<Set<string>>(new Set())
  const [scriptType, setScriptType] = useState<MultiSigType>('all')
  const [required, setRequired] = useState(1)
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

  const script =
    addresses.size > 1 &&
    keyHashesResult.isOk &&
    cardano.buildMultiSigScript(keyHashesResult.data, scriptType, required)

  const scriptAddress = script && cardano.getScriptAddress(script, config.isMainnet)

  const addAddress = (address: string) => {
    setAddresses(new Set(addresses).add(address))
  }

  const deleteAddress = (address: string) => {
    const set = new Set(addresses)
    set.delete(address)
    setAddresses(set)
  }

  const base64Script = script && Buffer.from(script.to_bytes()).toString('base64')

  return (
    <Layout>
      <h1 className='my-8 font-bold text-2xl text-center'>New Treasury</h1>
      <div className='space-y-2'>
        <Panel title='Native Script'>
          {scriptAddress && <h2 className='text-center mt-4 font-bold font-mono'>{scriptAddress.to_bech32()}</h2>}
          {addresses.size === 1 && <p className='border-b border-gray-100 text-center p-4 text-gray-400'>Need more than 1 addresses</p>}
          {addresses.size > 1 &&
            <div className='flex justify-center border-b'>
              <div className='flex p-2 space-x-2 items-center'>
                <select className='rounded-md p-2' onChange={(e) => setScriptType(e.target.value as MultiSigType)}>
                  <option value="all">All</option>
                  <option value="any">Any</option>
                  <option value="atLeast">At least</option>
                </select>
                {scriptType == 'atLeast' &&
                  <input type='number'
                    className='border rounded-md p-1'
                    value={required}
                    step={1}
                    min={1}
                    max={addresses.size}
                    onChange={(e) => setRequired(parseInt(e.target.value))} />
                }
                <div className='p-2'>of&nbsp;{addresses.size}</div>
              </div>
            </div>}
          {addresses.size > 0 &&
            <ul className='divide-y border-b'>
              {Array.from(addresses).map((address) => {
                return (
                  <li key={address} className='flex p-4 items-center'>
                    <div className='grow font-mono'>
                      <p>{address}</p>
                      <KeyHashLabel cardano={cardano} address={address} />
                    </div>
                    <nav className='flex items-center'>
                      <button>
                        <XIcon className='h-5 w-5' onClick={() => deleteAddress(address)} />
                      </button>
                    </nav>
                  </li>
                )
              })}
            </ul>}
          <AddAddress cardano={cardano} onAdd={addAddress} />
        </Panel>
        {script && <SaveTreasury cardano={cardano} script={script} />}
        {base64Script &&
          <div className='flex justify-center'>
            <Link href={`/treasuries/${encodeURIComponent(base64Script)}`}>
              <a
                className='py-3 px-4 font-bold text-lg bg-green-100 text-green-500 rounded-full shadow disabled:bg-gray-100 disabled:text-gray-500'>
                Create Transaction
              </a>
            </Link>
          </div>
        }
      </div>
    </Layout>
  )
}

export default NewTreasury
