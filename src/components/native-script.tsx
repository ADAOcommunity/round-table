import type { NativeScript, NativeScripts, Vkeywitness } from '@dcspark/cardano-multiplatform-lib-browser'
import { nanoid } from 'nanoid'
import type { NextPage } from 'next'
import { Cardano, toIter } from '../cardano/multiplatform-lib'
import { LockClosedIcon, LockOpenIcon, PencilIcon, ShieldCheckIcon } from '@heroicons/react/solid'

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
        </div>
      </li>
    )
  }

  script = nativeScript.as_timelock_expiry()
  if (script) return (
    <li className={liClassName}>
      <div className='flex space-x-1 items-center'>
        <ExpiryBadge />
        <span>{script.slot().to_str()}</span>
      </div>
    </li>
  )

  script = nativeScript.as_timelock_start()
  if (script) return (
    <li className={liClassName}>
      <div className='flex space-x-1 items-center'>
        <StartBadge />
        <span>{script.slot().to_str()}</span>
      </div>
    </li>
  )

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
