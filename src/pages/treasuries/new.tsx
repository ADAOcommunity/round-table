import type { NextPage } from 'next'
import { useState, KeyboardEventHandler, ChangeEventHandler, FocusEventHandler, useEffect, useContext, MouseEventHandler } from 'react'
import { Hero, Layout, Panel } from '../../components/layout'
import { getResult, useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import type { Cardano, MultiSigType } from '../../cardano/multiplatform-lib'
import { Loading } from '../../components/status'
import type { Ed25519KeyHash, NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { PlusIcon, TrashIcon } from '@heroicons/react/solid'
import { isAddressNetworkCorrect, SaveTreasuryButton } from '../../components/transaction'
import { ConfigContext } from '../../cardano/config'
import { nanoid } from 'nanoid'
import Modal from '../../components/modal'
import { useGetTipQuery } from '../../cardano/query-api'

type KeyHashInput = {
  id: string
  address?: string
  hash: Ed25519KeyHash
}

const TimeLockInput: NextPage<{
  label: string
  className?: string
  isEnabled: boolean
  setIsEnabled: (_: boolean) => void
  value: number
  setValue: (_: number) => void
}> = ({ className, label, isEnabled, setIsEnabled, value, setValue }) => {
  return (
    <div className={className}>
      <label className='space-x-1'>
        <span>{label}</span>
        <input
          type='checkbox'
          checked={isEnabled}
          onChange={() => setIsEnabled(!isEnabled)} />
      </label>
      <div>
        {isEnabled && <NumberInput className='block w-full p-2 border rounded' min={0} step={1000} value={value} onCommit={setValue} />}
      </div>
    </div>
  )
}

const TimeLockInputs: NextPage<{
  className?: string
  isTimeLockAfter: boolean
  setIsTimeLockAfter: (_: boolean) => void
  timeLockAfter: number
  setTimeLockAfter: (_: number) => void
  isTimeLockBefore: boolean
  setIsTimeLockBefore: (_: boolean) => void
  timeLockBefore: number
  setTimeLockBefore: (_: number) => void
}> = ({ className, isTimeLockAfter, setIsTimeLockAfter, timeLockAfter, setTimeLockAfter, isTimeLockBefore, setIsTimeLockBefore, timeLockBefore, setTimeLockBefore }) => {
  const { data } = useGetTipQuery({
    pollInterval: 5000
  })
  const currentSlotNumber = data?.cardano.tip.slotNo

  if (!currentSlotNumber) return null

  return (
    <div className={className}>
      <div className='grid grid-cols-3 gap-4'>
        <TimeLockInput
          className='space-y-1'
          value={timeLockBefore}
          setValue={setTimeLockBefore}
          label='Locked before'
          isEnabled={isTimeLockBefore}
          setIsEnabled={setIsTimeLockBefore} />
        <div className='space-y-1'>
          <div>Current Slot</div>
          <div className='py-2'>{currentSlotNumber}</div>
        </div>
        <TimeLockInput
          className='space-y-1'
          value={timeLockAfter}
          setValue={setTimeLockAfter}
          label='Locked after'
          isEnabled={isTimeLockAfter}
          setIsEnabled={setIsTimeLockAfter} />
      </div>
    </div>
  )
}

const AddAddress: NextPage<{
  cardano: Cardano
  onAdd: (_: KeyHashInput) => void
  onCancel: () => void
}> = ({ cardano, onAdd, onCancel }) => {
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
    }
  }

  const cancelHandle: MouseEventHandler<HTMLButtonElement> = () => {
    onCancel()
  }

  const enterPressHandle: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.shiftKey == false && event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className='space-y-2'>
      <label className='space-y-1'>
        <div className="after:content-['*'] after:text-red-500">New Signer (min. 2)</div>
        <textarea
          className={['block w-full border p-2 rounded', isValid ? '' : 'text-red-500'].join(' ')}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={enterPressHandle}
          rows={4}
          value={address}
          placeholder="Add signer address and press enter">
        </textarea>
      </label>
      <nav className='flex justify-end space-x-2'>
        <button
          onClick={cancelHandle}
          className='border rounded p-2 text-sky-700'>
          Cancel
        </button>
        <button
          disabled={!isValid}
          onClick={submit}
          className='flex py-2 px-4 items-center space-x-1 rounded text-white bg-sky-700 disabled:border disabled:text-gray-400 disabled:bg-gray-100'>
          <PlusIcon className='h-4' />
          <span>Add Address</span>
        </button>
      </nav>
    </div>
  )
}

const NumberInput: NextPage<{
  step?: number
  min?: number
  max?: number
  className?: string
  value: number
  onCommit: (_: number) => void
}> = ({ className, min, max, step, value, onCommit }) => {
  const [localValue, setLocalValue] = useState(value.toString())

  useEffect(() => {
    let isMounted = true

    isMounted && setLocalValue(value.toString())

    return () => {
      isMounted = false
    }
  }, [value])

  const changeHandle: ChangeEventHandler<HTMLInputElement> = (event) => {
    setLocalValue(event.target.value)
  }

  const blurHandle: FocusEventHandler<HTMLInputElement> = () => {
    const parsedValue = parse(localValue)
    if (isNaN(parsedValue)) {
      setLocalValue(value.toString())
    } else {
      setLocalValue(parsedValue.toString())
      onCommit(parsedValue)
    }
  }

  const keyPressHandle: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (!/[0-9]/.test(event.code)) {
      event.preventDefault()
    }
  }

  function parse(input: string): number {
    const parsedValue = parseInt(input)

    if (min && parsedValue < min) return min
    if (max && parsedValue > max) return max
    return parsedValue
  }

  return (
    <input
      type='number'
      className={className}
      value={localValue}
      onChange={changeHandle}
      onBlur={blurHandle}
      onKeyPress={keyPressHandle}
      min={min} max={max} step={step} />
  )
}

const RequiredNumberInput: NextPage<{
  className?: string
  max: number
  required: number
  onCommit: (_: number) => void
}> = ({ className, required, max, onCommit }) => {
  return (
    <NumberInput
      className={className}
      value={required}
      step={1}
      min={1}
      max={max}
      onCommit={onCommit} />
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isTimeLockAfter, setIsTimeLockAfter] = useState(false)
  const [timeLockAfter, setTimeLockAfter] = useState(0)
  const [isTimeLockBefore, setIsTimeLockBefore] = useState(false)
  const [timeLockBefore, setTimeLockBefore] = useState(0)
  const cardano = useCardanoMultiplatformLib()
  if (!cardano) return <Loading />;

  const getScript = (): NativeScript | undefined => {
    const { NativeScript, NativeScripts, ScriptPubkey, ScriptAll, ScriptAny, ScriptNOfK, TimelockStart, TimelockExpiry, BigNum } = cardano.lib
    const scripts = NativeScripts.new()
    keyHashInputs.forEach((input) => {
      const script = NativeScript.new_script_pubkey(ScriptPubkey.new(input.hash))
      scripts.add(script)
      return
    })

    if (isTimeLockAfter) {
      const slot = BigNum.from_str(timeLockAfter.toString())
      const script = NativeScript.new_timelock_start(TimelockStart.new(slot))
      scripts.add(script)
    }

    if (isTimeLockBefore) {
      const slot = BigNum.from_str(timeLockBefore.toString())
      const script = NativeScript.new_timelock_expiry(TimelockExpiry.new(slot))
      scripts.add(script)
    }

    if (scripts.len() < 1) return

    switch (scriptType) {
      case 'all': return NativeScript.new_script_all(ScriptAll.new(scripts))
      case 'any': return NativeScript.new_script_any(ScriptAny.new(scripts))
      case 'atLeast': return NativeScript.new_script_n_of_k(ScriptNOfK.new(required, scripts))
    }
  }

  const closeModal = () => setIsModalOpen(false)

  const addKeyHashInput = (keyHashInput: KeyHashInput) => {
    setKeyHashInputs(keyHashInputs.concat(keyHashInput))
    closeModal()
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
            <button
              onClick={() => setIsModalOpen(true)}
              className='flex text-sky-700 items-center space-x-1'>
              <PlusIcon className='w-4' />
              <span>Add signer</span>
            </button>
            <TimeLockInputs
              timeLockAfter={timeLockAfter}
              setTimeLockAfter={setTimeLockAfter}
              isTimeLockAfter={isTimeLockAfter}
              setIsTimeLockAfter={setIsTimeLockAfter}
              timeLockBefore={timeLockBefore}
              setTimeLockBefore={setTimeLockBefore}
              isTimeLockBefore={isTimeLockBefore}
              setIsTimeLockBefore={setIsTimeLockBefore} />
            {keyHashInputs.length > 0 && <>
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
              </div>
            </>}
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
      <Modal
        className='bg-white p-4 rounded sm:w-full md:w-1/2 lg:w-1/3'
        isOpen={isModalOpen}
        onClose={closeModal}>
        <AddAddress cardano={cardano} onAdd={addKeyHashInput} onCancel={closeModal} />
      </Modal>
    </Layout>
  )
}

export default NewTreasury
