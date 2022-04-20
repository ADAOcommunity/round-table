import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { nanoid } from 'nanoid'
import type { NextPage } from 'next'
import { toIter } from '../cardano/multiplatform-lib'

type Timelock = { type: 'expiry' | 'start', slot: string }
type PubKey = { type: 'key', hash: string }
type Script =
  | { type: 'all' | 'any', items: Array<Timelock | PubKey | Script> }
  | { type: 'atLeast', items: Array<Timelock | PubKey | Script>, required: number }
  | Timelock
  | PubKey

function convertScript(script: NativeScript): Script {
  let result;

  result = script.as_timelock_expiry()?.to_js_value()
  if (result) return { type: 'expiry', slot: result.slot }

  result = script.as_timelock_start()?.to_js_value()
  if (result) return { type: 'start', slot: result.slot }

  result = script.as_script_pubkey()?.to_js_value()
  if (result) return { type: 'key', hash: result.addr_keyhash }

  result = script.as_script_all()?.native_scripts()
  if (result) return { type: 'all', items: Array.from(toIter(result)).map(convertScript) }

  result = script.as_script_any()?.native_scripts()
  if (result) return { type: 'any', items: Array.from(toIter(result)).map(convertScript) }

  result = script.as_script_n_of_k()
  if (result) return { type: 'atLeast', required: result.n(), items: Array.from(toIter(result.native_scripts())).map(convertScript) }

  console.error(script)
  throw new Error('unknown native script')
}

const NativeScriptView: NextPage<{
  script: Script
  headerClassName?: string
  ulClassName?: string
  liClassName?: string
  className?: string
}> = ({ className, headerClassName, ulClassName, liClassName, script }) => {
  if (script.type === 'key') return <li className={liClassName}>Signature: {script.hash}</li>;
  if (script.type === 'expiry') return <li className={liClassName}>After slot: {script.slot}</li>;
  if (script.type === 'start') return <li className={liClassName}>Before slot: {script.slot}</li>;
  if (script.type === 'all') return (
    <div className={className}>
      <header className={headerClassName}>Require all to spend</header>
      <ul className={ulClassName}>
        {script.items.map((item) => <NativeScriptView key={nanoid()} className={className} script={item} />)}
      </ul>
    </div>
  )
  if (script.type === 'any') return (
    <div className={className}>
      <header className={headerClassName}>Require any to spend</header>
      <ul className={ulClassName}>
        {script.items.map((item) => <NativeScriptView key={nanoid()} className={className} script={item} />)}
      </ul>
    </div>
  )
  if (script.type === 'atLeast') return (
    <div className={className}>
      <header className={headerClassName}>Require least {script.required} to spend</header>
      <ul className={ulClassName}>
        {script.items.map((item) => <NativeScriptView key={nanoid()} className={className} script={item} />)}
      </ul>
    </div>
  )
  return null
}

export { convertScript, NativeScriptView }
