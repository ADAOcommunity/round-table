import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { encodeCardanoData, getResult, useCardanoSerializationLib } from '../../../cardano/serialization-lib'
import { Hero, Layout, Panel } from '../../../components/layout'
import { ErrorMessage, Loading } from '../../../components/status'
import type { NativeScript } from '@adaocommunity/cardano-serialization-lib-browser'
import { NativeScriptViewer, SaveTreasuryButton } from '../../../components/transaction'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../db'
import { useEffect, useState } from 'react'

const EditTreasury: NextPage<{
  script: NativeScript
}> = ({ script }) => {
  const treasury = useLiveQuery(async () => db.treasuries.get(encodeCardanoData(script, 'base64')), [script])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

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
      <footer className='flex justify-end p-4 bg-gray-100'>
        <SaveTreasuryButton
          className='px-4 py-2 bg-sky-700 text-white rounded shadow disabled:text-gray-400 disabled:bg-transparent'
          name={name}
          description={description}
          script={script}>
          Save Treasury
        </SaveTreasuryButton>
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
          <p>Only descriptive information can be changed. If you want to change the signers, you have to create a new treasury.</p>
        </Hero>
        <Panel>
          <NativeScriptViewer className='p-4 space-y-2' cardano={cardano} script={script} />
        </Panel>
        <EditTreasury script={script} />
      </div>
    </Layout>
  )
}

export default GetTreasury
