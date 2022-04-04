import type { NativeScript } from '@adaocommunity/cardano-serialization-lib-browser'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { encodeCardanoData, getResult, useCardanoSerializationLib } from '../../../cardano/serialization-lib'
import type { Cardano } from '../../../cardano/serialization-lib'
import { Layout, Panel } from '../../../components/layout'
import { ErrorMessage, Loading } from '../../../components/status'
import { NativeScriptInfoViewer, NativeScriptViewer } from '../../../components/transaction'
import Link from 'next/link'

const ShowTreasury: NextPage<{
  cardano: Cardano
  script: NativeScript
}> = ({ cardano, script }) => {
  const base64CBOR = encodeCardanoData(script, 'base64')

  return (
    <Panel>
      <NativeScriptInfoViewer className='space-y-1 px-4 pt-4' script={script} />
      <NativeScriptViewer className='p-4 space-y-2' cardano={cardano} script={script} />
      <footer className='flex justify-end p-4 bg-gray-100'>
        <Link href={`/treasuries/${encodeURIComponent(base64CBOR)}/edit`}>
          <a className='px-4 py-2 border text-sky-700 rounded'>Edit Info</a>
        </Link>
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
      <ShowTreasury cardano={cardano} script={script} />
    </Layout>
  )
}

export default GetTreasury
