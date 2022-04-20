import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { nanoid } from 'nanoid'
import type { NextPage } from 'next'
import { toIter } from '../cardano/multiplatform-lib'
import { LockClosedIcon, LockOpenIcon, PencilIcon } from '@heroicons/react/solid'

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
        <div className='flex items-center space-x-1 p-1 rounded text-sky-900 bg-sky-100'>
          <PencilIcon className='w-4' />
          <span>Signature</span>
        </div>
        <span>{script.addr_keyhash().to_hex()}</span>
      </div>
    </li>
  )

  script = nativeScript.as_timelock_expiry()
  if (script) return (
    <li className={liClassName}>
      <div className='flex space-x-1 items-center'>
        <div className='flex items-center space-x-1 p-1 rounded text-indigo-900 bg-indigo-100'>
          <LockClosedIcon className='w-4' />
          <span>Expiry</span>
        </div>
        <span>{script.slot().to_str()}</span>
      </div>
    </li>
  )

  script = nativeScript.as_timelock_start()
  if (script) return (
    <li className={liClassName}>
      <div className='flex space-x-1 items-center'>
        <div className='flex items-center space-x-1 p-1 rounded text-teal-900 bg-teal-100'>
          <LockOpenIcon className='w-4' />
          <span>Start</span>
        </div>
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

export { NativeScriptViewer }
