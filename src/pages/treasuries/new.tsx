import type { NextPage } from 'next'
import { useState, KeyboardEventHandler, ChangeEventHandler, FocusEventHandler, useEffect, useContext } from 'react'
import { Hero, Layout, Panel } from '../../components/layout'
import { getResult, useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import type { Cardano, MultiSigType } from '../../cardano/multiplatform-lib'
import { Loading } from '../../components/status'
import type { Ed25519KeyHash, NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { PlusIcon, TrashIcon } from '@heroicons/react/solid'
import { isAddressNetworkCorrect, SaveTreasuryButton } from '../../components/transaction'
import { ConfigContext } from '../../cardano/config'
import { nanoid } from 'nanoid'

type KeyHashInput = {
  id: string
  address?: string
  hash: Ed25519KeyHash
}

const AddAddress: NextPage<{
  cardano: Cardano
  onAdd: (_: KeyHashInput) => void
}> = ({ cardano, onAdd }) => {
  const [address, setAddress] = useState('')
  const [config, _] = useContext(ConfigContext)

  const result = getResult(() => {
    const addressObject = cardano.lib.Address.from_bech32(address)
    if (!isAddressNetworkCorrect(config, addressObject)) throw new Error('Wrong network')
    return addressObject.as_base()?.payment_cred().to_keyhash()
  })

  const isValid = result.isOk && !!result.data

  const submit = () => {
    if (result.isOk && result.data) {
      onAdd({ id: nanoid(), address, hash: result.data })
      setAddress('')
    }
  }

  const enterPressHandle: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.shiftKey == false && event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  return (
    <label className='block space-y-1'>
      <div>New Signer (min. 2)</div>
      <div className='flex space-x-2 items-start'>
        <textarea
          className={['block w-full border p-2 rounded', isValid ? '' : 'text-red-500'].join(' ')}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={enterPressHandle}
          rows={1}
          value={address}
          placeholder="Add signer address and press enter">
        </textarea>
        <button
          disabled={!isValid}
          onClick={submit}
          className='flex p-2 items-center space-x-1 border rounded text-sky-700 disabled:text-gray-400'>
          <PlusIcon className='h-4' />
          <span>Add</span>
        </button>
      </div>
    </label>
  )
}

const RequiredNumberInput: NextPage<{
  className?: string
  max: number
  required: number
  onCommit: (_: number) => void
}> = ({ className, required, max, onCommit }) => {
  const [value, setValue] = useState(required.toString())

  const changeHandle: ChangeEventHandler<HTMLInputElement> = (event) => {
    const value = event.target.value
    setValue(value)
  }

  const blurHandle: FocusEventHandler<HTMLInputElement> = () => {
    const parsedValue = parse(value)
    onCommit(parsedValue)
  }

  useEffect(() => {
    let isMounted = true

    isMounted && setValue(required.toString())

    return () => {
      isMounted = false
    }
  }, [required])

  function parse(input: string): number {
    const parsedValue = parseInt(input)

    if (isNaN(parsedValue)) return 1
    if (parsedValue < 1) return 1
    if (parsedValue > max) return max
    return parsedValue
  }

  return (
    <input type='number'
      className={className}
      value={value}
      step={1}
      min={1}
      max={max}
      onBlur={blurHandle}
      onChange={changeHandle} />
  )
}

const KeyHashList: NextPage<{
  className?: string
  keyHashInputs: KeyHashInput[]
  deleteKeyHashInput: (keyHashHex: string) => void
}> = ({ className, keyHashInputs, deleteKeyHashInput }) => {
  if (keyHashInputs.length <= 0) return null

  return (
    <div className={className}>
      <div>Signers</div>
      <ul className='border divide-y rounded'>
        {keyHashInputs.map(({ id, address, hash }) => {
          return (
            <li key={id} className='flex items-center p-2'>
              <div className='grow'>
                <div>{hash.to_hex()}</div>
                <div className='text-sm truncate'>{address}</div>
              </div>
              <button className='p-2'>
                <TrashIcon className='w-4' onClick={() => deleteKeyHashInput(id)} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const NewTreasury: NextPage = () => {
  const [keyHashInputs, setKeyHashInputs] = useState<KeyHashInput[]>([])
  const [scriptType, setScriptType] = useState<MultiSigType>('all')
  const [required, setRequired] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const cardano = useCardanoMultiplatformLib()
  if (!cardano) return <Loading />;

  const getScript = (): NativeScript | undefined => {
    if (keyHashInputs.length <= 1) return
    const hashes = keyHashInputs.map(({ hash }) => hash)
    return cardano.buildMultiSigScript(hashes, scriptType, required)
  }

  const addKeyHashInput = (keyHashInput: KeyHashInput) => {
    setKeyHashInputs(keyHashInputs.concat(keyHashInput))
  }

  const deleteKeyHashInput = (id: string) => {
    setKeyHashInputs(keyHashInputs.filter((keyHashInput) => id !== keyHashInput.id))
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
              <div className="after:content-['*'] after:text-red-500">Name</div>
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
            <KeyHashList className='space-y-1' keyHashInputs={keyHashInputs} deleteKeyHashInput={deleteKeyHashInput} />
            {keyHashInputs.length > 1 &&
              <div className='space-y-1'>
                <div>Required Signers</div>
                <div className='flex space-x-2 items-center'>
                  <select className='bg-white border rounded text-sm p-2' onChange={(e) => setScriptType(e.target.value as MultiSigType)}>
                    <option value="all">All</option>
                    <option value="any">Any</option>
                    <option value="atLeast">At least</option>
                  </select>
                  {scriptType == 'atLeast' &&
                    <RequiredNumberInput
                      className='border rounded p-1'
                      max={keyHashInputs.length}
                      required={required}
                      onCommit={setRequired} />
                  }
                  <div className='p-2 space-x-1'>
                    <span>of</span>
                    <span>{keyHashInputs.length}</span>
                  </div>
                </div>
              </div>}
            <hr />
            <AddAddress cardano={cardano} onAdd={addKeyHashInput} />
          </div>
          <footer className='flex justify-end p-4 bg-gray-100'>
            <SaveTreasuryButton
              cardano={cardano}
              className='px-4 py-2 bg-sky-700 text-white rounded disabled:border disabled:text-gray-400 disabled:bg-gray-100'
              name={name}
              description={description}
              script={getScript()}>
              Save Treasury
            </SaveTreasuryButton>
          </footer>
        </Panel>
      </div>
    </Layout>
  )
}

export default NewTreasury
