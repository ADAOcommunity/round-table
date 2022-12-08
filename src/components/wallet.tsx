import { useContext, useEffect, useState, useMemo } from 'react'
import type { FC, ChangeEventHandler, FocusEventHandler, KeyboardEventHandler } from 'react'
import { ConfigContext, isMainnet } from '../cardano/config'
import { getResult, isAddressNetworkCorrect } from '../cardano/multiplatform-lib'
import type { Cardano } from '../cardano/multiplatform-lib'
import { estimateDateBySlot, estimateSlotByDate } from '../cardano/utils'
import { Panel, Modal } from '../components/layout'
import { ExclamationCircleIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { Calendar, DateContext } from '../components/time'
import { useRouter } from 'next/router'
import { NotificationContext } from '../components/notification'
import { db } from '../db'
import type { MultisigWalletParams, Policy } from '../db'
import { getMultisigWalletPath } from '../route'
import { ExpiryBadge, SignatureBadge, StartBadge, Timelock } from './native-script'
import { getAssetName, getAvailableReward, getBalanceByPaymentAddresses, getCurrentDelegation, getPolicyId, useSummaryQuery } from '../cardano/query-api'
import type { Value } from '../cardano/query-api'
import { ADAAmount, AssetAmount } from './currency'
import { StakePoolInfo } from './transaction'
import type { Delegation } from '@cardano-graphql/client-ts/api'
import { Loading } from './status'

const NumberInput: FC<{
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
    if (!/\d/.test(event.code)) {
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

const RequiredNumberInput: FC<{
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

const SlotInput: FC<{
  className?: string
  initialSlot?: number
  cancel: () => void
  confirm: (slot: number) => void
  isLocked: (date: Date, selectedDate: Date) => boolean
}> = ({ className, cancel, confirm, initialSlot, isLocked }) => {
  const [config, _] = useContext(ConfigContext)
  const [slot, setSlot] = useState<number>(initialSlot ?? estimateSlotByDate(new Date(), config.network))
  const date = estimateDateBySlot(slot, config.network)

  return (
    <div className={className}>
      <NumberInput className='block w-full p-2 border rounded' min={0} step={1000} value={slot} onCommit={setSlot} />
      <Calendar isRed={isLocked} selectedDate={date} onChange={(date) => setSlot(estimateSlotByDate(date, config.network))} />
      <nav className='flex justify-end space-x-2'>
        <button
          onClick={cancel}
          className='border rounded p-2 text-sky-700'>
          Cancel
        </button>
        <button
          onClick={() => confirm(slot)}
          className='flex py-2 px-4 items-center space-x-1 rounded text-white bg-sky-700'>
          <span>Confirm</span>
        </button>
      </nav>
    </div>
  )
}

const AddTimelock: FC<{
  className?: string
  add: (policy: Policy) => void
  cancel: () => void
}> = ({ className, add, cancel }) => {
  const [type, setType] = useState<'TimelockStart' | 'TimelockExpiry'>('TimelockStart')
  const [now, _t] = useContext(DateContext)

  return (
    <div className={className}>
      <div className='flex'>
        <nav className='border rounded border-sky-700 text-sm text-sky-700'>
          <button
            className='disabled:bg-sky-700 disabled:text-white px-2 py-1'
            disabled={type === 'TimelockStart'}
            onClick={() => setType('TimelockStart')}>
            Start Slot
          </button>
          <button
            className='disabled:bg-sky-700 disabled:text-white px-2 py-1'
            disabled={type === 'TimelockExpiry'}
            onClick={() => setType('TimelockExpiry')}>
            Expiry Slot
          </button>
        </nav>
      </div>
      {type === 'TimelockStart' && <div className='p-2 rounded bg-red-700 text-white'>
        <h6 className='flex font-semibold space-x-1 items-center'>
          <ExclamationCircleIcon className='w-4' />
          <span>WARNING</span>
        </h6>
        <p>Be careful with this option. It returns false before the slot/time is reached. You might not want to wait too long to unlock it.</p>
      </div>}
      {type === 'TimelockExpiry' && <div className='p-2 rounded bg-red-700 text-white'>
        <h6 className='flex font-semibold space-x-1 items-center'>
          <ExclamationCircleIcon className='w-4' />
          <span>WARNING</span>
        </h6>
        <p>Be careful with this option. It returns false after the slot/time is passed which could lead to coins locked/burned forever when it is combined with All policy and At Least policy or used alone.</p>
      </div>}
      <SlotInput
        className='space-y-1'
        cancel={cancel}
        confirm={(slot) => add({ type, slot })}
        isLocked={type === 'TimelockStart' ? () => false : (date) => date <= now} />
    </div>
  )
}

const AddAddress: FC<{
  cardano: Cardano
  className?: string
  add: (address: string) => void
  cancel: () => void
}> = ({ cardano, className, add, cancel }) => {
  const [address, setAddress] = useState('')
  const [config, _] = useContext(ConfigContext)
  const result = useMemo(() => getResult(() => {
    const { Address } = cardano.lib
    if (!Address.is_valid_bech32(address)) throw new Error('Address has to be in Bech32 format.')
    const addressObject = Address.from_bech32(address)
    if (!isAddressNetworkCorrect(config, addressObject)) throw new Error('Wrong network.')
    if (!addressObject.as_base()?.payment_cred().to_keyhash()) throw new Error('No key hash of payment found.')
    if (!addressObject.as_base()?.stake_cred().to_keyhash()) throw new Error('No key hash of staking found.')
    return addressObject
  }), [address, cardano, config])

  const enterPressHandle: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (!event.shiftKey && event.key === 'Enter') {
      event.preventDefault()
      add(address)
    }
  }

  return (
    <div className={className}>
      <label className='space-y-1'>
        <div className="after:content-['*'] after:text-red-500">New Signer</div>
        <textarea
          className={['block w-full border p-2 rounded', result.isOk ? '' : 'text-red-500'].join(' ')}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={enterPressHandle}
          rows={4}
          value={address}
          placeholder="Add signer address and press enter">
        </textarea>
        {address && !result.isOk && <div className='text-red-500'>{result.message}</div>}
      </label>
      <nav className='flex justify-end space-x-2'>
        <button
          onClick={cancel}
          className='border rounded p-2 text-sky-700'>
          Cancel
        </button>
        <button
          disabled={!result.isOk}
          onClick={() => add(address)}
          className='flex py-2 px-4 items-center space-x-1 rounded text-white bg-sky-700 disabled:border disabled:text-gray-400 disabled:bg-gray-100'>
          <PlusIcon className='w-4' />
          <span>Add Address</span>
        </button>
      </nav>
    </div>
  )
}

const parsePolicyType = (type: string): 'All' | 'Any' | 'NofK' => {
  switch (type) {
    case 'All': return type
    case 'Any': return type
    case 'NofK': return type
    default: throw new Error(`Unsupported policy type: ${type}`)
  }
}

const EditPolicy: FC<{
  cardano: Cardano
  className?: string
  ulClassName?: string
  liClassName?: string
  policy: Policy
  setPolicy: (policy: Policy) => void
}> = ({ cardano, className, ulClassName, liClassName, policy, setPolicy }) => {
  const [modal, setModal] = useState<'address' | 'timelock' | undefined>()
  const closeModal = () => setModal(undefined)

  if (typeof policy === 'string') return (
    <>
      <SignatureBadge />
      <span>{policy}</span>
    </>
  )

  if (policy.type === 'TimelockStart') return (
    <div className='flex items-center space-x-1'>
      <StartBadge />
      <Timelock type={policy.type} slot={policy.slot} />
    </div>
  )

  if (policy.type === 'TimelockExpiry') return (
    <div className='flex items-center space-x-1'>
      <ExpiryBadge />
      <Timelock type={policy.type} slot={policy.slot} />
    </div>
  )

  const addPolicy = (newPolicy: Policy) => {
    setPolicy({ ...policy, policies: policy.policies.concat(newPolicy) })
    closeModal()
  }

  const policies = policy.policies

  const setPolicyType: ChangeEventHandler<HTMLSelectElement> = (event) => {
    const type = parsePolicyType(event.target.value)
    if (type === 'NofK') {
      setPolicy({ type, policies, number: policies.length })
      return
    }
    setPolicy({ type, policies })
  }

  return (
    <div className={className}>
      <nav className='flex space-x-2 text-sm'>
        {policies.length > 0 && <div className='flex border rounded divide-x items-center'>
          <select className='bg-white text-sky-700 px-2 py-1' onChange={setPolicyType}>
            <option value="All">All</option>
            <option value="Any">Any</option>
            <option value="NofK">At least</option>
          </select>
          {policy.type == 'NofK' &&
            <RequiredNumberInput
              className='p-1 h-full'
              max={policies.length}
              required={policy.number}
              onCommit={(number) => setPolicy({ ...policy, number })} />}
          <div className='px-2 py-1 space-x-1'>
            <span>of</span>
            <span>{policies.length}</span>
          </div>
        </div>}
        <button
          onClick={() => setModal('address')}
          className='flex items-center text-sky-700 space-x-1 border rounded px-2 py-1'>
          <PlusIcon className='w-4' />
          <span>Add Signer</span>
        </button>
        <button
          onClick={() => setModal('timelock')}
          className='flex items-center text-sky-700 space-x-1 border rounded px-2 py-1'>
          <PlusIcon className='w-4' />
          <span>Add Timelock</span>
        </button>
        <button
          onClick={() => addPolicy({ type: 'All', policies: [] })}
          className='flex items-center text-sky-700 space-x-1 border rounded px-2 py-1'>
          <PlusIcon className='w-4' />
          <span>Add Nested Policy</span>
        </button>
      </nav>
      {policies.length > 0 && <ul className={ulClassName}>
        {policies.map((subPolicy, index) => {
          const removeItem = () => {
            setPolicy({ ...policy, policies: policies.filter((_, i) => i !== index) })
          }
          const setSubPolicy = (subPolicy: Policy) => {
            setPolicy({ ...policy, policies: policies.map((p, i) => i === index ? subPolicy : p) })
          }
          return (
            <li key={index} className={liClassName}>
              <div className='flex items-center space-x-1 grow break-all'>
                <EditPolicy
                  cardano={cardano}
                  className={className}
                  ulClassName={ulClassName}
                  liClassName={liClassName}
                  policy={subPolicy}
                  setPolicy={setSubPolicy} />
              </div>
              <button className='p-2' onClick={removeItem}>
                <XMarkIcon className='w-4' />
              </button>
            </li>
          )
        })}
      </ul>}
      {modal === 'address' && <Modal className='bg-white p-4 rounded sm:w-full md:w-1/2 lg:w-1/3' onBackgroundClick={closeModal}>
        <AddAddress className='space-y-2' cardano={cardano} add={addPolicy} cancel={closeModal} />
      </Modal>}
      {modal === 'timelock' && <Modal className='bg-white p-4 rounded sm:w-full md:w-1/2 lg:w-1/3' onBackgroundClick={closeModal}>
        <AddTimelock className='space-y-2' add={addPolicy} cancel={closeModal} />
      </Modal>}
    </div>
  )
}

const EditMultisigWallet: FC<{
  cardano: Cardano
  params: MultisigWalletParams
}> = ({ cardano, params }) => {
  const router = useRouter()
  const { notify } = useContext(NotificationContext)
  const [config, _] = useContext(ConfigContext)
  const [name, setName] = useState(params.name)
  const [description, setDescription] = useState(params.description)
  const [policy, setPolicy] = useState(params.policy)
  const canSave = name.length > 0

  useEffect(() => {
    setName(params.name)
    setDescription(params.description)
    setPolicy(params.policy)
  }, [params])

  const save = () => {
    const id = cardano.getPolicyAddress(policy, isMainnet(config)).to_bech32()
    db.multisigWallets
      .put({ name, description, policy, id, updatedAt: new Date() }, id)
      .then(() => router.push(getMultisigWalletPath(policy)))
      .catch(() => notify('error', 'Failed to save'))
  }

  return (
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
            placeholder='Describe the wallet'
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}>
          </textarea>
        </label>
        <div className='space-y-1'>
          <div>Policy</div>
          <EditPolicy
            cardano={cardano}
            className='space-y-2 w-full'
            ulClassName='border rounded divide-y'
            liClassName='flex justify-between items-start p-2'
            policy={policy}
            setPolicy={setPolicy} />
        </div>
      </div>
      <footer className='flex justify-end p-4 bg-gray-100'>
        <button
          className='px-4 py-2 bg-sky-700 text-white rounded disabled:border disabled:text-gray-400 disabled:bg-gray-100'
          disabled={!canSave}
          onClick={save}>
          Save
        </button>
      </footer>
    </Panel>
  )
}

const RemoveWallet: FC<{
  remove: () => void
  walletName: string
}> = ({ walletName, remove }) => {
  const [name, setName] = useState('')

  useEffect(() => {
    setName('')
  }, [walletName])

  return (
    <Panel>
      <div className='p-4 space-y-2'>
        <h2 className='font-semibold'>Remove Wallet</h2>
        <div>
          <p>Do you really want to remove <strong className='font-semibold'>{walletName}</strong>?</p>
          <p>By removing the wallet you will just remove the record in your browser. The assets in it remain untouched. Type the wallet name below to confirm.</p>
        </div>
        <input
          className='p-2 border rounded w-full'
          type='text'
          placeholder='Type the wallet name to confirm'
          value={name}
          onChange={(e) => setName(e.target.value)} />
      </div>
      <footer className='flex justify-end p-4 bg-gray-100'>
        <button
          className='px-4 py-2 bg-red-700 text-white rounded disabled:border disabled:text-gray-400 disabled:bg-gray-100'
          disabled={walletName !== name}
          onClick={remove}>
          REMOVE
        </button>
      </footer>
    </Panel>
  )
}

const Summary: FC<{
  addresses: string[]
  rewardAddress: string
}> = ({ addresses, rewardAddress }) => {
  const { data } = useSummaryQuery({
    variables: { addresses, rewardAddress },
    fetchPolicy: 'network-only'
  })

  const result: { balance: Value, reward: bigint, delegation?: Delegation } | undefined = useMemo(() => {
    if (!data) return
    const { paymentAddresses, rewards_aggregate, withdrawals_aggregate, stakeRegistrations_aggregate, stakeDeregistrations_aggregate, delegations } = data
    return {
      balance: getBalanceByPaymentAddresses(paymentAddresses),
      reward: getAvailableReward(rewards_aggregate, withdrawals_aggregate),
      delegation: getCurrentDelegation(stakeRegistrations_aggregate, stakeDeregistrations_aggregate, delegations)
    }
  }, [data])

  if (!result) return (
    <Modal>
      <Loading />
    </Modal>
  )

  const { balance, reward, delegation } = result

  return (
    <Panel className='p-4 space-y-2'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
        <div className='space-y-1'>
          <h2 className='font-semibold'>Balance</h2>
          <div>
            <ADAAmount lovelace={balance.lovelace} />
            <span> + </span>
            (<ADAAmount lovelace={reward} /> reward)
          </div>
        </div>
        <div className='space-y-1'>
          <h2 className='font-semibold'>Delegation</h2>
          <div>{rewardAddress}</div>
          {delegation && <StakePoolInfo stakePool={delegation.stakePool} />}
          {!delegation && <div>N/A</div>}
        </div>
      </div>
      {balance.assets.size > 0 && <div className='space-y-1'>
        <h2 className='font-semibold'>Assets</h2>
        <ul className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2'>
          {Array.from(balance.assets, ([id, quantity]) => <li key={id} className='p-2 border rounded'>
            <AssetAmount
              quantity={quantity}
              decimals={0}
              symbol={Buffer.from(getAssetName(id), 'hex').toString('ascii')} />
            <div className='space-x-1 text-sm truncate'>
              <span>{getPolicyId(id)}</span>
            </div>
          </li>)}
        </ul>
      </div>}
    </Panel>
  )
}

export { EditMultisigWallet, SlotInput, RemoveWallet, Summary }
