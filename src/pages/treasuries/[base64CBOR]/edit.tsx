import { NextPage } from 'next'
import { NextRouter, useRouter } from 'next/router'
import { encodeCardanoData, getResult, useCardanoSerializationLib } from '../../../cardano/serialization-lib'
import { Hero, Layout, Panel } from '../../../components/layout'
import { ErrorMessage, Loading } from '../../../components/status'
import type { NativeScript } from '@adaocommunity/cardano-serialization-lib-browser'
import { NativeScriptViewer, SaveTreasuryButton } from '../../../components/transaction'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../db'
import { useEffect, useState } from 'react'

const EditTreasury: NextPage<{
  router: NextRouter
  script: NativeScript
}> = ({ router, script }) => {
  const treasury = useLiveQuery(async () => db.treasuries.get(encodeCardanoData(script, 'base64')), [script])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const deleteHandle = () => {
    db
      .treasuries
      .delete(encodeCardanoData(script, 'base64'))
      .then(() => router.push('/treasuries/new'))
  }

  useEffect(() => {
    let isMounted = true

    if (isMounted && treasury) {
      setName(treasury.name)
      setDescription(treasury.description)
    }

    return () => {
      isMounted = false
    }
  }, [treasury])

  return (
    <Panel>
      <div className='p-4 space-y-2'>
        <label className='block space-y-1'>
          <div>Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='p-2 block border w-full rounded'
            placeholder='Write Name' />
        </label>
        <label className='block space-y-1'>
          <div>Description</div>
          <textarea
            className='p-2 block border w-full rounded'
            placeholder='Describe the treasury'
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}>
          </textarea>
        </label>
      </div>
      <footer className='flex justify-between p-4 bg-gray-100'>
        <button onClick={deleteHandle} className='px-4 py-2 text-sky-700'>Delete</button>
        <div className='space-x-2'>
          <button className='px-4 py-2 border rounded text-sky-700' onClick={() => router.back()}>Back</button>
          <SaveTreasuryButton
            className='px-4 py-2 bg-sky-700 text-white rounded shadow disabled:text-gray-400 disabled:bg-transparent'
            name={name}
            description={description}
            script={script}>
            Save Treasury
          </SaveTreasuryButton>
        </div>
      </footer>
    </Panel>
  )
}

const GetTreasury: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query
  const cardano = useCardanoSerializationLib()

  if (!cardano) return <Loading />;
  if (typeof base64CBOR !== 'string') return <ErrorMessage>Invalid URL</ErrorMessage>;
  const parseResult = getResult(() => cardano.lib.NativeScript.from_bytes(Buffer.from(base64CBOR, 'base64')))
  if (!parseResult.isOk) return <ErrorMessage>Invalid script</ErrorMessage>;
  const script = parseResult.data

  return (
    <Layout>
      <div className='space-y-2'>
        <Hero>
          <h1 className='font-semibold text-lg'>Edit Treasury Information</h1>
          <p>Only descriptive information can be changed. If you want to change the signers, you have to create a new treasury. Deleting the info does not change any state of the treasury on chain. By deleting you merely deregister or forget it locally.</p>
        </Hero>
        <Panel>
          <NativeScriptViewer className='p-4 space-y-2' cardano={cardano} script={script} />
        </Panel>
        <EditTreasury router={router} script={script} />
      </div>
    </Layout>
  )
}

export default GetTreasury
