import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { nanoid } from 'nanoid'
import type { NextPage } from 'next'
import { toIter } from '../cardano/multiplatform-lib'

const NativeScriptViewer: NextPage<{
  nativeScript: NativeScript
  headerClassName?: string
  ulClassName?: string
  liClassName?: string
  className?: string
}> = ({ className, headerClassName, ulClassName, liClassName, nativeScript }) => {
  let script;

  script = nativeScript.as_script_pubkey()
  if (script) return <li className={liClassName}>Signature: {script.addr_keyhash().to_hex()}</li>;

  script = nativeScript.as_timelock_expiry()
  if (script) return <li className={liClassName}>After slot: {script.slot().to_str()}</li>;

  script = nativeScript.as_timelock_start()
  if (script) return <li className={liClassName}>Before slot: {script.slot().to_str()}</li>;

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
