import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import Layout from '../../components/layout'
import { getResult, useCardanoSerializationLib } from '../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../components/status'
import { useContext } from 'react'
import { ConfigContext } from '../../cardano/config'

const NewProposal: NextPage = () => {
  const [config, _] = useContext(ConfigContext)
  const router = useRouter()
  const { treasury } = router.query
  const cardano = useCardanoSerializationLib()

  if (!cardano) return <Loading />;
  if (typeof treasury !== 'string') return <ErrorMessage>Invalid script</ErrorMessage>;

  const parseResult = getResult(() => cardano.lib.NativeScript.from_bytes(Buffer.from(treasury, 'base64')))
  if (!parseResult.isOk) return <ErrorMessage>Invalid script</ErrorMessage>;
  const script = parseResult.data
  const scriptAddress = cardano.getScriptAddress(script, config.isMainnet)

  return (
    <Layout>
      <h1 className='my-8 font-bold text-2xl text-center'>Treasury - Proposal</h1>
      <h2 className='my-4 text-center'>{scriptAddress}</h2>
    </Layout>
  )
}

export default NewProposal
