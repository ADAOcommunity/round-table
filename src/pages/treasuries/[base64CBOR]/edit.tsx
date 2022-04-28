import type { NextPage } from 'next'
import { NextRouter, useRouter } from 'next/router'
import { Cardano, getResult, useCardanoMultiplatformLib } from '../../../cardano/multiplatform-lib'
import { BackButton, Hero, Layout, Panel } from '../../../components/layout'
import { ErrorMessage, Loading } from '../../../components/status'
import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { DeleteTreasuryButton, SaveTreasuryButton } from '../../../components/transaction'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../db'
import { useContext, useEffect, useState } from 'react'
import { NativeScriptViewer } from '../../../components/native-script'
import { estimateSlotByDate } from '../../../cardano/utils'
import { ConfigContext } from '../../../cardano/config'
import { DateContext } from '../../../components/time'

const EditTreasury: NextPage<{
  cardano: Cardano
  router: NextRouter
  script: NativeScript
}> = ({ cardano, script }) => {
  const hash = cardano.hashScript(script)
  const treasury = useLiveQuery(async () => db.treasuries.get(hash.to_hex()), [])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [config, _c] = useContext(ConfigContext)
  const [date, _t] = useContext(DateContext)

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
          <div className="after:content-['*'] after:text-red-500">Name</div>
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
        <div className='space-y-1'>
          <div>Script Details</div>
          <NativeScriptViewer
            verifyingData={{ signatures: new Map(), currentSlot: estimateSlotByDate(date, config.isMainnet) }}
            className='p-2 border rounded space-y-2'
            headerClassName='font-semibold'
            ulClassName='space-y-1'
            nativeScript={script} />
        </div>
      </div>
      <footer className='flex justify-between p-4 bg-gray-100'>
        <DeleteTreasuryButton
          cardano={cardano}
          className='px-4 py-2 text-sky-700 disabled:text-gray-400'
          script={script}>
          Delete
        </DeleteTreasuryButton>
        <div className='space-x-2'>
          <BackButton className='px-4 py-2 border rounded text-sky-700'>Back</BackButton>
          <SaveTreasuryButton
            cardano={cardano}
            className='px-4 py-2 bg-sky-700 text-white rounded disabled:border disabled:text-gray-400 disabled:bg-gray-100'
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
  const cardano = useCardanoMultiplatformLib()

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
        <EditTreasury cardano={cardano} router={router} script={script} />
      </div>
    </Layout>
  )
}

export default GetTreasury
