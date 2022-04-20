import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { nanoid } from 'nanoid'
import type { NextPage } from 'next'
import { toIter } from '../cardano/multiplatform-lib'
import { LockClosedIcon, LockOpenIcon, PencilIcon } from '@heroicons/react/solid'

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
  headerClassName?: string
  ulClassName?: string
  liClassName?: string
  className?: string
}> = ({ className, headerClassName, ulClassName, liClassName, nativeScript }) => {
  let script;

  script = nativeScript.as_script_pubkey()
  if (script) return (
    <li className={liClassName}>
      <div className='flex space-x-1 items-center'>
        <SignatureBadge />
        <span>{script.addr_keyhash().to_hex()}</span>
      </div>
    </li>
  )

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
        {Array.from(toIter(script.native_scripts())).map((item) => <NativeScriptViewer key={nanoid()} className={className} nativeScript={item} />)}
      </ul>
    </div>
  )

  script = nativeScript.as_script_any()
  if (script) return (
    <div className={className}>
      <header className={headerClassName}>Require any to spend</header>
      <ul className={ulClassName}>
        {Array.from(toIter(script.native_scripts())).map((item) => <NativeScriptViewer key={nanoid()} className={className} nativeScript={item} />)}
      </ul>
    </div>
  )

  script = nativeScript.as_script_n_of_k()
  if (script) return (
    <div className={className}>
      <header className={headerClassName}>Require least {script.n()} to spend</header>
      <ul className={ulClassName}>
        {Array.from(toIter(script.native_scripts())).map((item) => <NativeScriptViewer key={nanoid()} className={className} nativeScript={item} />)}
      </ul>
    </div>
  )

  return null
}

export { SignatureBadge, ExpiryBadge, StartBadge, NativeScriptViewer }
