import type { BigNum, NativeScript, Vkeywitness } from '@dcspark/cardano-multiplatform-lib-browser'
import { useContext, useMemo } from 'react'
import type { FC, ReactNode } from 'react'
import { toIter } from '../cardano/multiplatform-lib'
import type { Cardano } from '../cardano/multiplatform-lib'
import { NoSymbolIcon, ClipboardDocumentCheckIcon, ClipboardDocumentIcon, LockClosedIcon, LockOpenIcon, PencilIcon, ShieldCheckIcon } from '@heroicons/react/24/solid'
import { CopyButton } from './layout'
import { estimateDateBySlot, estimateSlotByDate } from '../cardano/utils'
import { ConfigContext } from '../cardano/config'
import { DateContext } from './time'

function minSlot(slots: Array<BigNum | undefined>): BigNum | undefined {
  if (slots.length === 0) return
  return slots.reduce((prev, cur) => {
    if (!cur) return prev
    if (!prev) return cur
    if (cur.compare(prev) <= 0) return cur
    return prev
  })
}

function maxSlot(slots: Array<BigNum | undefined>): BigNum | undefined {
  if (slots.length === 0) return
  return slots.reduce((prev, cur) => {
    if (!cur) return prev
    if (!prev) return cur
    if (cur.compare(prev) >= 0) return cur
    return prev
  })
}

function suggestStartSlot(nativeScript: NativeScript): BigNum | undefined {
  let script;

  script = nativeScript.as_timelock_start()
  if (script) return script.slot()

  script = nativeScript.as_script_all()?.native_scripts()
  if (script) return maxSlot(Array.from(toIter(script)).map(suggestStartSlot))

  script = nativeScript.as_script_any()?.native_scripts()
  if (script) return maxSlot(Array.from(toIter(script)).map(suggestStartSlot))

  script = nativeScript.as_script_n_of_k()?.native_scripts()
  if (script) return maxSlot(Array.from(toIter(script)).map(suggestStartSlot))

  return
}

function suggestExpirySlot(nativeScript: NativeScript): BigNum | undefined {
  let script;

  script = nativeScript.as_timelock_expiry()
  if (script) return script.slot()

  script = nativeScript.as_script_all()?.native_scripts()
  if (script) return minSlot(Array.from(toIter(script)).map(suggestExpirySlot))

  script = nativeScript.as_script_any()?.native_scripts()
  if (script) return minSlot(Array.from(toIter(script)).map(suggestExpirySlot))

  script = nativeScript.as_script_n_of_k()?.native_scripts()
  if (script) return minSlot(Array.from(toIter(script)).map(suggestExpirySlot))

  return
}

type VerifyingData = Map<string, Vkeywitness>

const Badge: FC<{
  className?: string
  children: ReactNode
}> = ({ className, children }) => {
  const baseClassName = 'flex items-center space-x-1 p-1 rounded'
  return (
    <div className={[baseClassName, className].join(' ')}>
      {children}
    </div>
  )
}

const SignatureBadge: FC = () => {
  return (
    <Badge className='text-sky-900 bg-sky-100'>
      <PencilIcon className='w-4' />
      <span>Signature</span>
    </Badge>
  )
}

const ExpiryBadge: FC = () => {
  return (
    <Badge className='text-indigo-900 bg-indigo-100'>
      <LockClosedIcon className='w-4' />
      <span>Expiry</span>
    </Badge>
  )
}

const StartBadge: FC = () => {
  return (
    <Badge className='text-teal-900 bg-teal-100'>
      <LockOpenIcon className='w-4' />
      <span>Start</span>
    </Badge>
  )
}

const Timelock: FC<{
  slot: number
  type: 'TimelockStart' | 'TimelockExpiry'
}> = ({ slot, type }) => {
  const [config, _] = useContext(ConfigContext)
  const [now, _t] = useContext(DateContext)
  const currentSlot = estimateSlotByDate(now, config.isMainnet)
  const isValid: boolean = useMemo(() => {
    switch (type) {
      case 'TimelockStart': return currentSlot > slot
      case 'TimelockExpiry': return currentSlot < slot
    }
  }, [slot, currentSlot, type])
  return (
    <div className={['flex', 'space-x-1', 'items-center', isValid ? 'text-green-500' : 'text-red-500'].join(' ')}>
      {type === 'TimelockStart' && <StartBadge />}
      {type === 'TimelockExpiry' && <ExpiryBadge />}
      <span>{slot}</span>
      <span>(est. {estimateDateBySlot(slot, config.isMainnet).toLocaleString()})</span>
      {!isValid && <NoSymbolIcon className='w-4' />}
      {isValid && <ShieldCheckIcon className='w-4' />}
    </div>
  )
}

const NativeScriptViewer: FC<{
  nativeScript: NativeScript
  cardano?: Cardano
  headerClassName?: string
  ulClassName?: string
  liClassName?: string
  className?: string
  verifyingData?: VerifyingData
}> = ({ cardano, className, headerClassName, ulClassName, liClassName, nativeScript, verifyingData }) => {
  let script;

  script = nativeScript.as_script_pubkey()
  if (script) {
    const keyHashHex = script.addr_keyhash().to_hex()
    const signature = verifyingData?.get(keyHashHex)
    const color = signature ? 'text-green-500' : ''
    return (
      <div className={['flex space-x-1 items-center', color].join(' ')}>
        <SignatureBadge />
        <span>{keyHashHex}</span>
        {signature && <ShieldCheckIcon className='w-4' />}
        {signature && cardano && <CopyButton copied={<ClipboardDocumentCheckIcon className='w-4' />} ms={500} getContent={() => cardano.buildSignatureSetHex([signature])}><ClipboardDocumentIcon className='w-4' /></CopyButton>}
      </div>
    )
  }

  script = nativeScript.as_timelock_expiry()
  if (script) {
    const slot = parseInt(script.slot().to_str())
    return (
      <Timelock type='TimelockExpiry' slot={slot} />
    )
  }

  script = nativeScript.as_timelock_start()
  if (script) {
    const slot = parseInt(script.slot().to_str())
    return (
      <Timelock type='TimelockStart' slot={slot} />
    )
  }

  script = nativeScript.as_script_all()
  if (script) return (
    <div className={className}>
      <header className={headerClassName}>Require all to spend</header>
      <ul className={ulClassName}>
        {Array.from(toIter(script.native_scripts())).map((nativeScript, index) =>
          <li key={index} className={liClassName}>
            <NativeScriptViewer
              cardano={cardano}
              verifyingData={verifyingData}
              className={className}
              nativeScript={nativeScript}
              headerClassName={headerClassName}
              ulClassName={ulClassName}
              liClassName={liClassName} />
          </li>
        )}
      </ul>
    </div>
  )

  script = nativeScript.as_script_any()
  if (script) return (
    <div className={className}>
      <header className={headerClassName}>Require any to spend</header>
      <ul className={ulClassName}>
        {Array.from(toIter(script.native_scripts())).map((nativeScript, index) =>
          <li key={index} className={liClassName}>
            <NativeScriptViewer
              cardano={cardano}
              verifyingData={verifyingData}
              className={className}
              nativeScript={nativeScript}
              headerClassName={headerClassName}
              ulClassName={ulClassName}
              liClassName={liClassName} />
          </li>
        )}
      </ul>
    </div>
  )

  script = nativeScript.as_script_n_of_k()
  if (script) return (
    <div className={className}>
      <header className={headerClassName}>Require least {script.n()} to spend</header>
      <ul className={ulClassName}>
        {Array.from(toIter(script.native_scripts())).map((nativeScript, index) =>
          <li key={index} className={liClassName}>
            <NativeScriptViewer
              cardano={cardano}
              verifyingData={verifyingData}
              className={className}
              nativeScript={nativeScript}
              headerClassName={headerClassName}
              ulClassName={ulClassName}
              liClassName={liClassName} />
          </li>
        )}
      </ul>
    </div>
  )

  throw new Error('Unsupported NativeScript')
}

export type { VerifyingData }
export { suggestStartSlot, suggestExpirySlot, SignatureBadge, ExpiryBadge, StartBadge, NativeScriptViewer, Timelock }
