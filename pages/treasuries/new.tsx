import type { NextPage } from 'next'
import { useState, useContext, ChangeEvent } from 'react'
import { Layout, Panel } from '../../components/layout'
import { Result, useCardanoSerializationLib } from '../../cardano/serialization-lib'
import type { Cardano, MultiSigType } from '../../cardano/serialization-lib'
import Link from 'next/link'
import { ConfigContext } from '../../cardano/config'
import { Loading } from '../../components/status'
import type { Ed25519KeyHash } from '@emurgo/cardano-serialization-lib-browser'
import { XIcon } from '@heroicons/react/solid'

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
      <h1 className='my-8 font-bold text-2xl text-center'>Create Multi-Sig Address</h1>
      <div className='space-y-2'>
        <Panel title='Address Setting'>
          {addresses.size > 0 &&
            <ul className='divide-y border-b'>
              {Array.from(addresses).map((address) => {
                const result = cardano.parseAddress(address)
                const keyHash = result.isOk ? cardano.getAddressKeyHash(result.data) : result
                return (
                  <li key={address} className='flex p-4 items-center'>
                    <div className='grow font-mono'>
                      <p>{address}</p>
                      {keyHash.isOk && <p className='text-gray-500'>{Buffer.from(keyHash.data.to_bytes()).toString('hex')}</p>}
                      {!keyHash.isOk && <p className='text-red-500'>Invalid Address</p>}
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
        {addresses.size > 0 &&
          <Panel title='Policy Setting'>
            <div className='flex p-4 space-x-2 items-center'>
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
          </Panel>}
        {addresses.size > 0 &&
          <Panel title='Generated Address'>
            <div>
              {!scriptAddress && <p className='border-b border-gray-100 text-center p-4 text-gray-400'>Need more than 1 addresses</p>}
              {script && scriptAddress &&
                <p className='border-b border-gray-100 font-bold text-center p-4'>
                  <Link href={`/treasuries/${encodeURIComponent(base64Script)}`}><a>{scriptAddress.to_bech32()}</a></Link>
                </p>
              }
            </div>
          </Panel>}
      </div>
    </Layout>
  )
}

type AddAddressProps = {
  cardano: Cardano
  onAdd: (address: string) => void
}

function AddAddress({ cardano, onAdd }: AddAddressProps) {
  const [value, setValue] = useState('')
  const [isChanged, setChanged] = useState(false)

  const parseResult = cardano.parseAddress(value)
  const keyHashResult =
    parseResult.isOk ? cardano.getAddressKeyHash(parseResult.data) : parseResult

  const submitHandle = () => {
    if (parseResult.isOk) {
      onAdd(value)
    }
    setValue('')
    setChanged(false)
  }

  const changeHandle = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setChanged(true)
    setValue(event.target.value)
  }

  return (
    <div>
      <div className='p-4'>
        <textarea
          className='block w-full border border-gray-400 rounded-md p-2'
          onChange={changeHandle}
          rows={4}
          value={value}
          placeholder="Address">
        </textarea>
        {isChanged && !parseResult.isOk && <p className='text-sm py-1 text-red-400'>{parseResult.message}</p>}
        {keyHashResult.isOk && <p className='text-sm py-1 text-gray-400'>
          {Buffer.from(keyHashResult.data.to_bytes()).toString('hex')}
        </p>}
      </div>
      <footer className='flex flex-row-reverse px-4 py-3 bg-gray-100'>
        <button className='py-2 px-4 border bg-blue-600 rounded-md text-white bg-blue-600 disabled:bg-gray-400'
          onClick={submitHandle}
          disabled={!keyHashResult.isOk}>
          Add Address
        </button>
      </footer>
    </div>
  )
}

export default NewTreasury
