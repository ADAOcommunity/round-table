import type { NativeScript, Vkeywitness } from '@dcspark/cardano-multiplatform-lib-browser'
import { useContext, useMemo } from 'react'
import type { FC, ReactNode } from 'react'
import { toIter } from '../cardano/multiplatform-lib'
import type { Cardano } from '../cardano/multiplatform-lib'
import { NoSymbolIcon, ClipboardDocumentCheckIcon, ClipboardDocumentIcon, LockClosedIcon, LockOpenIcon, PencilIcon, ShieldCheckIcon } from '@heroicons/react/24/solid'
import { CopyButton } from './layout'
import { estimateDateBySlot } from '../cardano/utils'
import { ConfigContext } from '../cardano/config'

type VerifyingData = {
  signatures?: Map<string, Vkeywitness>,
  txStartSlot?: number,
  txExpirySlot?: number
}

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

const TimelockViewer: FC<{
  slot: number
  isValid: boolean
}> = ({ slot, isValid }) => {
  const [config, _] = useContext(ConfigContext)
  return (
    <div className={['flex', 'space-x-1', 'items-center', isValid ? 'text-green-500' : 'text-red-500'].join(' ')}>
      <span>{slot}</span>
      <span>(est. {estimateDateBySlot(slot, config.network).toLocaleString()})</span>
      {!isValid && <NoSymbolIcon className='w-4' />}
      {isValid && <ShieldCheckIcon className='w-4' />}
    </div>
  )
}

const TimelockStartViewer: FC<{
  slot: number
  txStartSlot?: number
}> = ({ slot, txStartSlot }) => {
  const isValid = useMemo(() => {
    if (!txStartSlot) return false
    return txStartSlot >= slot
  }, [slot, txStartSlot])
  return (
    <TimelockViewer slot={slot} isValid={isValid} />
  )
}

const TimelockExpiryViewer: FC<{
  slot: number
  txExpirySlot?: number
}> = ({ slot, txExpirySlot }) => {
  const isValid = useMemo(() => {
    if (!txExpirySlot) return false
    return txExpirySlot <= slot
  }, [slot, txExpirySlot])
  return (
    <TimelockViewer slot={slot} isValid={isValid} />
  )
}

const SignatureViewer: FC<{
  name: string
  className?: string
  signature?: string
  signedClassName?: string
}> = ({ name, signature, className, signedClassName }) => {
  const color = signature ? signedClassName : ''

  return (
    <div className={[className, color].join(' ')}>
      <SignatureBadge />
      <div className='truncate'>{name}</div>
      <nav className='flex space-x-1'>
        {signature && <ShieldCheckIcon className='w-4' />}
        {signature && <CopyButton copied={<ClipboardDocumentCheckIcon className='w-4' />} ms={1000} content={signature}><ClipboardDocumentIcon className='w-4' /></CopyButton>}
      </nav>
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
    const signature = verifyingData?.signatures?.get(keyHashHex)
    const signatureHex = cardano?.buildSignatureSetHex(signature)
    return (
      <SignatureViewer name={keyHashHex} signature={signatureHex} className='flex space-x-1 items-center' signedClassName='text-green-500' />
    )
  }

  script = nativeScript.as_timelock_expiry()
  if (script) {
    const slot = parseInt(script.slot().to_str())
    return (
      <div className='flex items-center space-x-1'>
        <ExpiryBadge />
        <TimelockExpiryViewer slot={slot} txExpirySlot={verifyingData?.txExpirySlot} />
      </div>
    )
  }

  script = nativeScript.as_timelock_start()
  if (script) {
    const slot = parseInt(script.slot().to_str())
    return (
      <div className='flex items-center space-x-1'>
        <StartBadge />
        <TimelockStartViewer slot={slot} txStartSlot={verifyingData?.txStartSlot} />
      </div>
    )
  }

  script = nativeScript.as_script_all()
  if (script) return (
    <div className={className}>
      <header className={headerClassName}>Require all</header>
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
      <header className={headerClassName}>Require any</header>
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
      <header className={headerClassName}>Require least {script.n()}</header>
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
export { SignatureBadge, ExpiryBadge, StartBadge, NativeScriptViewer, TimelockStartViewer, TimelockExpiryViewer, SignatureViewer }
