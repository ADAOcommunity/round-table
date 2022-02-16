import type { NextPage } from 'next'
import { useState, ChangeEvent } from 'react'
import Layout from '../../components/layout'
import { CardanoSerializationLib } from '../../cardano/serialization-lib'
import type { Cardano } from '../../cardano/serialization-lib'
import { Buffer } from 'buffer'

const NewScript: NextPage = () => {
  const [keyHashes, setKeyHashes] = useState<string[]>([])
  const [cardano, setCardano] = useState<Cardano | undefined>(undefined)

  CardanoSerializationLib.load().then((instance) => setCardano(instance))

  const onAddKeyHash = (input: string) => {
    let list = keyHashes
    let value = input.trim()
    if (value.length > 0 && cardano) {
      let keyHash = toHex(cardano.getBech32AddressKeyHash(input).to_bytes())
      if (!list.includes(keyHash))
        list = list.concat(keyHash)
    }
    setKeyHashes(list)
  }

  return (
    <Layout>
      {cardano && <AddKeyHash onAdd={onAddKeyHash} />}
      {keyHashes.length > 0 && <Tabs keyHashes={keyHashes} />}
    </Layout>
  )
}

const toHex = (input: ArrayBuffer) => Buffer.from(input).toString("hex")

type TabsProps = {
  keyHashes: string[]
}

function Tabs({ keyHashes }: TabsProps) {
  const [isInspect, setInspect] = useState(false)
  const JSONScript =
    JSON.stringify(
      { scripts: keyHashes.map((value) => ({ keyHash: value, type: 'sig' })), type: 'all' },
      null, 2
    )
  const code = <code>{JSONScript}</code>
  const table = (
    <table className='table-auto border-collapse w-full text-sm'>
      <thead>
        <tr>
          <th className='border-b'>Key Hash</th>
        </tr>
      </thead>
      <tbody>
        {keyHashes.map((keyHash) => <tr key={keyHash}><td className='border-t'>{keyHash}</td></tr>)}
      </tbody>
    </table>
  )

  return (
    <div>
      <label>
        <input className='form' type="checkbox" defaultChecked={isInspect} onChange={() => setInspect(!isInspect)} />
        Show JSON
      </label>
      <div className='shadow sm:rounded-md sm:overflow-hidden mb-2'>
        {isInspect ? code : table}
      </div>
    </div >
  )
}

type AddKeyHashProps = {
  onAdd: (value: string) => void
}

function AddKeyHash({ onAdd }: AddKeyHashProps) {
  const [value, setValue] = useState('')
  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value)
  }
  const onClick = () => {
    onAdd(value)
    setValue('')
  }

  return (
    <div className='shadow mb-2'>
      <div className='px-4 py-5 bg-white space-y-6 sm:p-6'>
        <textarea className='shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md' onChange={onChange} rows={5} value={value}></textarea>
      </div>
      <div className='px-4 py-3 bg-gray-50 text-right sm:px-6'>
        <button className='inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700' onClick={onClick}>
          Add Key Hash
        </button>
      </div>
    </div>
  )
}

export default NewScript
