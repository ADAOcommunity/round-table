import type { NativeScript, NativeScripts, Vkeywitness } from '@dcspark/cardano-multiplatform-lib-browser'
import { nanoid } from 'nanoid'
import type { NextPage } from 'next'
import { Cardano, toIter } from '../cardano/multiplatform-lib'
import { BanIcon, ClipboardCheckIcon, ClipboardCopyIcon, LockClosedIcon, LockOpenIcon, PencilIcon, ShieldCheckIcon } from '@heroicons/react/solid'
import { CopyButton } from './layout'
import { estimateDateBySlot } from '../cardano/utils'
import { useContext } from 'react'
import { ConfigContext } from '../cardano/config'

type VerifyingData = {
  signatures: Map<string, Vkeywitness>
  currentSlot: number
}

const Badge: NextPage<{
  className?: string
}> = ({ className, children }) => {
  const baseClassName = 'flex items-center space-x-1 p-1 rounded'
  return (
    <div className={[baseClassName, className].join(' ')}>
      {children}
    </div>
  )
}

const SignatureBadge: NextPage = () => {
  return (
    <Badge className='text-sky-900 bg-sky-100'>
      <PencilIcon className='w-4' />
      <span>Signature</span>
    </Badge>
  )
}

const ExpiryBadge: NextPage = () => {
  return (
    <Badge className='text-indigo-900 bg-indigo-100'>
      <LockClosedIcon className='w-4' />
      <span>Expiry</span>
    </Badge>
  )
}

const StartBadge: NextPage = () => {
  return (
    <Badge className='text-teal-900 bg-teal-100'>
      <LockOpenIcon className='w-4' />
      <span>Start</span>
    </Badge>
  )
}

const NativeScriptViewer: NextPage<{
  nativeScript: NativeScript
  cardano?: Cardano
  headerClassName?: string
  ulClassName?: string
  liClassName?: string
  className?: string
  verifyingData?: VerifyingData
}> = ({ cardano, className, headerClassName, ulClassName, liClassName, nativeScript, verifyingData }) => {
  const [config, _] = useContext(ConfigContext)

  function renderNativeScripts(nativeScripts: NativeScripts) {
    return Array.from(toIter(nativeScripts)).map((nativeScript) =>
      <NativeScriptViewer
        key={nanoid()}
        cardano={cardano}
        verifyingData={verifyingData}
        className={className}
        nativeScript={nativeScript}
        headerClassName={headerClassName}
        ulClassName={ulClassName}
        liClassName={liClassName} />
    )
  }

  let script;

  script = nativeScript.as_script_pubkey()
  if (script) {
    const keyHashHex = script.addr_keyhash().to_hex()
    const signature = verifyingData?.signatures.get(keyHashHex)
    return (
      <li className={liClassName}>
        <div className={'flex space-x-1 items-center ' + (signature ? 'text-green-500' : '')}>
          <SignatureBadge />
          <span>{keyHashHex}</span>
          {signature && <ShieldCheckIcon className='w-4' />}
          {signature && cardano && <CopyButton copied={<ClipboardCheckIcon className='w-4' />} ms={500} getContent={() => cardano.buildSignatureSetHex([signature])}><ClipboardCopyIcon className='w-4' /></CopyButton>}
        </div>
      </li>
    )
  }

  script = nativeScript.as_timelock_expiry()
  if (script) {
    const currentSlot = verifyingData?.currentSlot
    const slot = parseInt(script.slot().to_str())
    let color = ''
    if (currentSlot && currentSlot > slot) color = 'text-red-500'
    if (currentSlot && currentSlot < slot) color = 'text-green-500'
    return (
      <li className={liClassName}>
        <div className={['flex space-x-1 items-center', color].join(' ')}>
          <ExpiryBadge />
          <span>{slot}</span>
          <span>(est. {estimateDateBySlot(slot, config.isMainnet).toLocaleDateString()})</span>
          {currentSlot && currentSlot > slot && <>
            <BanIcon className='w-4' />
          </>}
          {currentSlot && currentSlot < slot && <>
            <ShieldCheckIcon className='w-4' />
          </>}
        </div>
      </li>
    )
  }

  script = nativeScript.as_timelock_start()
  if (script) {
    const currentSlot = verifyingData?.currentSlot
    const slot = parseInt(script.slot().to_str())
    let color = ''
    if (currentSlot && currentSlot < slot) color = 'text-red-500'
    if (currentSlot && currentSlot > slot) color = 'text-green-500'
    return (
      <li className={liClassName}>
        <div className={['flex space-x-1 items-center', color].join(' ')}>
          <StartBadge />
          <span>{slot}</span>
          <span>(est. {estimateDateBySlot(slot, config.isMainnet).toLocaleDateString()})</span>
          {currentSlot && currentSlot < slot && <>
            <BanIcon className='w-4' />
          </>}
          {currentSlot && currentSlot > slot && <>
            <ShieldCheckIcon className='w-4' />
          </>}
        </div>
      </li>
    )
  }

  script = nativeScript.as_script_all()
  if (script) return (
    <div className={className}>
      <header className={headerClassName}>Require all to spend</header>
      <ul className={ulClassName}>
        {renderNativeScripts(script.native_scripts())}
      </ul>
    </div>
  )

  script = nativeScript.as_script_any()
  if (script) return (
    <div className={className}>
      <header className={headerClassName}>Require any to spend</header>
      <ul className={ulClassName}>
        {renderNativeScripts(script.native_scripts())}
      </ul>
    </div>
  )

  script = nativeScript.as_script_n_of_k()
  if (script) return (
    <div className={className}>
      <header className={headerClassName}>Require least {script.n()} to spend</header>
      <ul className={ulClassName}>
        {renderNativeScripts(script.native_scripts())}
      </ul>
    </div>
  )

  return null
}

export type { VerifyingData }
export { SignatureBadge, ExpiryBadge, StartBadge, NativeScriptViewer }
