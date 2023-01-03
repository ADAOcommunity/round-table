import { useCallback, useContext, useEffect, useState, useMemo } from 'react'
import type { FC, ChangeEventHandler, FocusEventHandler, KeyboardEventHandler, ReactNode } from 'react'
import { ConfigContext, isMainnet } from '../cardano/config'
import { isAddressNetworkCorrect, useCardanoMultiplatformLib } from '../cardano/multiplatform-lib'
import type { Cardano } from '../cardano/multiplatform-lib'
import { estimateDateBySlot, estimateSlotByDate, formatDerivationPath } from '../cardano/utils'
import { Panel, Modal, TextareaModalBox } from '../components/layout'
import { ChevronLeftIcon, ChevronRightIcon, ExclamationCircleIcon, PencilSquareIcon, PlusIcon, WalletIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { Calendar, useLiveDate, useLiveSlot } from '../components/time'
import { useRouter } from 'next/router'
import { NotificationContext } from '../components/notification'
import { db } from '../db'
import type { MultisigWalletParams, Policy, PersonalWallet } from '../db'
import { getMultisigWalletPath } from '../route'
import { ExpiryBadge, SignatureBadge, StartBadge, TimelockExpiryViewer, TimelockStartViewer } from './native-script'
import { getAssetName, getAvailableReward, getBalanceByPaymentAddresses, getCurrentDelegation, getPolicyId, useSummaryQuery } from '../cardano/query-api'
import type { Value } from '../cardano/query-api'
import { ADAAmount, AssetAmount } from './currency'
import { StakePoolInfo } from './transaction'
import type { Delegation } from '@cardano-graphql/client-ts/api'
import { PartialLoading } from './status'
import { useLiveQuery } from 'dexie-react-hooks'
import { AddressableContent } from './address'

const DerivationPath: FC<{
  keyHash?: Uint8Array
}> = ({ keyHash }) => {
  const keyHashIndex = useLiveQuery(async () => keyHash && db.keyHashIndices.get(keyHash), [keyHash])
  const derivationPath = useMemo(() => keyHashIndex?.derivationPath, [keyHashIndex])

  if (!derivationPath) return null

  return (
    <>{formatDerivationPath(derivationPath)}</>
  )
}

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
    setLocalValue(value.toString())
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
  isLocked?: (date: Date, selectedDate: Date) => boolean
}> = ({ className, cancel, confirm, initialSlot, isLocked }) => {
  const [config, _] = useContext(ConfigContext)
  const [slot, setSlot] = useState<number>(initialSlot ?? estimateSlotByDate(new Date(), config.network))
  const date = estimateDateBySlot(slot, config.network)
  const changeDate = useCallback((date: Date) => setSlot(estimateSlotByDate(date, config.network)), [config.network])

  return (
    <div className={className}>
      <NumberInput className='block w-full p-2 border rounded ring-sky-500 focus:ring-1' min={0} step={1000} value={slot} onCommit={setSlot} />
      <Calendar isRed={isLocked} selectedDate={date} onChange={changeDate} />
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
  const now = useLiveDate()
  const confirmSlot = useCallback((slot: number) => add({ type, slot }), [add, type])
  const isLocked = useCallback((date: Date) => {
    if (type === 'TimelockExpiry') return date <= now
    return false
  }, [type, now])

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
        confirm={confirmSlot}
        isLocked={isLocked} />
    </div>
  )
}

const AddressButton: FC<{
  address: string
  className?: string
  onClick?: (address: string) => void
}> = ({ address, className, onClick }) => {
  const cardano = useCardanoMultiplatformLib()
  const payment = useMemo(() => cardano?.parseAddress(address).payment_cred()?.to_keyhash()?.to_bytes(), [cardano, address])
  const staking = useMemo(() => cardano?.parseAddress(address).staking_cred()?.to_keyhash()?.to_bytes(), [cardano, address])
  const click = useCallback(() => onClick && onClick(address), [address, onClick])
  return (
    <button onClick={click} className={className}>
      <div className='text-xs font-light break-all'>{address}</div>
      <div className='flex items-center justify-between text-sm text-sky-700'>
        <div><DerivationPath keyHash={payment} /></div>
        <div><DerivationPath keyHash={staking} /></div>
      </div>
    </button>
  )
}

const AddressButtonGroup: FC<{
  addresses: string[]
  className?: string
  onClick: (address: string) => void
}> = ({ addresses, className, onClick }) => {
  const perPage = 4
  const [page, setPage] = useState(1)
  const totalPage = useMemo(() => Math.ceil(addresses.length / perPage), [addresses, perPage])
  const showingAddresses = useMemo(() => {
    const start = (page - 1) * perPage
    const end = start + perPage
    return addresses.slice(start, end)
  }, [addresses, page, perPage])

  return (
    <div className={className}>
      {showingAddresses.map((address) => <AddressButton key={address} className='p-2 space-y-1 hover:bg-sky-100' onClick={onClick} address={address} />)}
      <div className='flex items-center justify-between text-sky-700 px-4'>
        <button
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          className='p-2 disabled:text-gray-400'>
          <ChevronLeftIcon className='w-6' />
        </button>
        <div>{page}/{totalPage}</div>
        <button
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPage}
          className='p-2 disabled:text-gray-400'>
          <ChevronRightIcon className='w-6' />
        </button>
      </div>
    </div>
  )
}

const AddAddressClassName = 'flex w-full items-center justify-between py-2 px-4 text-sky-700 disabled:bg-gray-100 disabled:text-gray-500 hover:bg-sky-100'
const AddAddress: FC<{
  cardano: Cardano
  className?: string
  add: (address: string) => void
  cancel: () => void
}> = ({ cardano, className, add, cancel }) => {
  const { notify } = useContext(NotificationContext)
  const personalWallets = useLiveQuery(async () => db.personalWallets.toArray())
  const [signingWallet, setSigningWallet] = useState<PersonalWallet | 'import' | undefined>()
  const [config, _] = useContext(ConfigContext)
  const signingAddresses: string[] | undefined = useMemo(() => {
    if (signingWallet && signingWallet !== 'import') {
      return Array.from(signingWallet.multisigAccounts, ([_, account]) => cardano.getAddressesFromMultisigAccount(account, isMainnet(config))).flat()
    }
  }, [cardano, config, signingWallet])
  const addAddress = useCallback((address: string) => {
    const { Address } = cardano.lib
    if (!Address.is_valid_bech32(address)) {
      notify('error', 'The address must be in Bech32')
      return
    }
    const addressObject = Address.from_bech32(address)
    if (!isAddressNetworkCorrect(config, addressObject)) {
      notify('error', 'Wrong network')
      return
    }
    if (!addressObject.as_base()?.payment_cred().to_keyhash()) {
      notify('error', 'No key hash of payment')
      return
    }
    if (!addressObject.as_base()?.stake_cred().to_keyhash()) {
      notify('error', 'No key hash of staking')
      return
    }
    add(address)
  }, [add, cardano, config, notify])

  useEffect(() => {
    if (personalWallets?.length === 0) setSigningWallet('import')
  }, [personalWallets])

  return (
    <div className={className}>
      {!signingWallet && <>
        <h2 className='font-semibold p-4 bg-gray-100 text-center'>Add Signer</h2>
        {personalWallets?.map((wallet) => <button
          key={wallet.id}
          onClick={() => setSigningWallet(wallet)}
          className={AddAddressClassName}>
          <WalletIcon className='w-6' />
          <span>{wallet.name}</span>
        </button>)}
        <button onClick={() => setSigningWallet('import')} className={AddAddressClassName}>
          <PencilSquareIcon className='w-6' />
          <span>Import</span>
        </button>
        <button onClick={cancel} className='w-full text-center text-sky-700 p-2 hover:bg-sky-100'>Cancel</button>
      </>}
      {signingWallet && <>
        <button
          onClick={() => setSigningWallet(undefined)}
          className='flex w-full items-center justify-center space-x-1 text-sky-700 p-2 hover:bg-sky-100'>
          <ChevronLeftIcon className='w-4' />
          <span>Choose Others</span>
        </button>
        {signingAddresses && <>
          {signingWallet !== 'import' && <h2 className='p-2 bg-gray-100 text-center'>{signingWallet.name}</h2>}
          <AddressButtonGroup className='divide-y' addresses={signingAddresses} onClick={addAddress} />
        </>}
        {!signingAddresses && <TextareaModalBox placeholder='Input receiving address' onConfirm={addAddress}>
          <PencilSquareIcon className='w-4' />
          <span>Add</span>
        </TextareaModalBox>}
      </>}
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

const EditTimelockStart: FC<{
  slot: number
}> = ({ slot }) => {
  const currentSlot = useLiveSlot()

  return (
    <TimelockStartViewer slot={slot} txStartSlot={currentSlot} />
  )
}

const EditTimelockExpiry: FC<{
  slot: number
}> = ({ slot }) => {
  const currentSlot = useLiveSlot()

  return (
    <TimelockExpiryViewer slot={slot} txExpirySlot={currentSlot} />
  )
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
  const closeModal = useCallback(() => setModal(undefined), [])
  const policies = useMemo(() => {
    if (typeof policy === 'string') return
    if (policy.type === 'TimelockStart') return
    if (policy.type === 'TimelockExpiry') return
    return policy.policies
  }, [policy])

  const addPolicy = useCallback((newPolicy: Policy) => {
    if (typeof policy === 'string') return
    if (policy.type === 'TimelockStart') return
    if (policy.type === 'TimelockExpiry') return
    setPolicy({ ...policy, policies: policy.policies.concat(newPolicy) })
    closeModal()
  }, [closeModal, policy, setPolicy])

  const setPolicyType: ChangeEventHandler<HTMLSelectElement> = useCallback((event) => {
    if (!policies) return
    const type = parsePolicyType(event.target.value)
    if (type === 'NofK') {
      setPolicy({ type, policies, number: policies.length })
      return
    }
    setPolicy({ type, policies })
  }, [policies, setPolicy])

  const setRequiredNumber = useCallback((number: number) => {
    if (typeof policy === 'string') return
    if (policy.type === 'NofK') setPolicy({ ...policy, number })
  }, [policy, setPolicy])

  if (typeof policy === 'string') return (
    <div className='flex items-start space-x-1'>
      <SignatureBadge />
      <div className='p-1 break-all'>{policy}</div>
    </div>
  )

  if (policy.type === 'TimelockStart') return (
    <div className='flex items-center space-x-1'>
      <StartBadge />
      <EditTimelockStart slot={policy.slot} />
    </div>
  )

  if (policy.type === 'TimelockExpiry') return (
    <div className='flex items-center space-x-1'>
      <ExpiryBadge />
      <EditTimelockExpiry slot={policy.slot} />
    </div>
  )

  return (
    <div className={className}>
      <nav className='flex space-x-2 text-sm'>
        {policies && policies.length > 0 && <div className='flex border rounded divide-x items-center ring-sky-500 focus-within:ring-1'>
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
              onCommit={setRequiredNumber} />}
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
      {policies && policies.length > 0 && <ul className={ulClassName}>
        {policies.map((subPolicy, index) => {
          const removeItem = () => {
            setPolicy({ ...policy, policies: policies.filter((_, i) => i !== index) })
          }
          const setSubPolicy = (subPolicy: Policy) => {
            setPolicy({ ...policy, policies: policies.map((p, i) => i === index ? subPolicy : p) })
          }
          return (
            <li key={index} className={liClassName}>
              <div className='grow'>
                <EditPolicy
                  cardano={cardano}
                  className={className}
                  ulClassName={ulClassName}
                  liClassName={liClassName}
                  policy={subPolicy}
                  setPolicy={setSubPolicy} />
              </div>
              <button className='p-1' onClick={removeItem}>
                <XMarkIcon className='w-5' />
              </button>
            </li>
          )
        })}
      </ul>}
      {modal === 'address' && <Modal className='w-80' onBackgroundClick={closeModal}>
        <AddAddress className='bg-white rounded divide-y overflow-hidden' cardano={cardano} add={addPolicy} cancel={closeModal} />
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
            className='p-2 block border w-full rounded ring-sky-500 focus:ring-1'
            placeholder='Write Name' />
        </label>
        <label className='block space-y-1'>
          <div>Description</div>
          <textarea
            className='p-2 block border w-full rounded ring-sky-500 focus:ring-1'
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
            ulClassName='border rounded divide-y text-sm'
            liClassName='flex justify-between items-start p-1'
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
          className='p-2 border rounded w-full ring-sky-500 focus:ring-1'
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
  children?: ReactNode
}> = ({ addresses, rewardAddress, children }) => {
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
    <PartialLoading />
  )

  const { balance, reward, delegation } = result

  return (
    <Panel>
      <div className='p-4 space-y-2'>
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
            <AddressableContent content={rewardAddress} scanType='stakekey' />
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
      </div>
      {children}
    </Panel>
  )
}

export { EditMultisigWallet, EditTimelockStart, EditTimelockExpiry, SlotInput, RemoveWallet, Summary, DerivationPath }
