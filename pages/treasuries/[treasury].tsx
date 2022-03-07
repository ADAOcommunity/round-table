import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import Layout from '../../components/layout'
import { getResult, useCardanoSerializationLib } from '../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../components/status'
import { useContext } from 'react'
import { ConfigContext } from '../../cardano/config'
import { NewTransaction } from '../../components/transaction'
import { useAddressUTxOsQuery, useProtocolParametersQuery } from '../../cardano/query-api'

const Treasury: NextPage = () => {
  const [config, _] = useContext(ConfigContext)
  const router = useRouter()
  const { treasury } = router.query
  const cardano = useCardanoSerializationLib()
  const protocolParameters = useProtocolParametersQuery(config)

  if (!cardano) return <Loading />;
  if (typeof treasury !== 'string') return <ErrorMessage>Invalid script</ErrorMessage>;
  const parseResult = getResult(() => cardano.lib.NativeScript.from_bytes(Buffer.from(treasury, 'base64')))
  if (!parseResult.isOk) return <ErrorMessage>Invalid script</ErrorMessage>;
  const script = parseResult.data
  const address = cardano.getScriptAddress(script, config.isMainnet)
  if (protocolParameters.type === 'loading') return <Loading />;
  if (protocolParameters.type === 'error') return <ErrorMessage>An error happened when query protocol parameters.</ErrorMessage>;

  const NewProposal = () => {
    const utxos = useAddressUTxOsQuery(address.to_bech32(), config)
    if (utxos.type === 'loading') return <Loading />;
    if (utxos.type === 'error') return <ErrorMessage>An error happened when query balance.</ErrorMessage>;

    return (
      <NewTransaction
        senderAddress={address}
        cardano={cardano}
        protocolParameters={protocolParameters.data}
        previewURI={(body) => `/treasuries/${encodeURIComponent(treasury)}/${body}`}
        utxos={utxos.data} />
    )
  }

  return (
    <Layout>
      <h1 className='my-8 font-bold text-2xl text-center'>Treasury - Proposal</h1>
      <h2 className='my-4 text-center'>{address.to_bech32()}</h2>
      <NewProposal />
    </Layout>
  )
}

export default Treasury
