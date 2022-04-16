import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout } from '../../../components/layout'
import { Cardano } from '../../../cardano/multiplatform-lib'
import { getResult, useCardanoMultiplatformLib } from '../../../cardano/multiplatform-lib'
import { ErrorMessage, Loading } from '../../../components/status'
import { useContext } from 'react'
import { ConfigContext } from '../../../cardano/config'
import { NativeScriptInfoViewer, NewTransaction } from '../../../components/transaction'
import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { useGetUTxOsToSpendQuery } from '../../../cardano/query-api'

const GetUTxOsToSpend: NextPage<{
  cardano: Cardano
  script: NativeScript
}> = ({ cardano, script }) => {

  const [config, _] = useContext(ConfigContext)
  const address = cardano.getScriptAddress(script, config.isMainnet)
  const { loading, error, data } = useGetUTxOsToSpendQuery({
    variables: { addresses: [address.to_bech32()] },
    fetchPolicy: 'network-only'
  })

  if (loading) return <Loading />;
  if (error) return <ErrorMessage>An error happened when query balance.</ErrorMessage>;

  if (!data) return <Loading />;
  const protocolParameters = data.cardano.currentEpoch.protocolParams
  if (!protocolParameters) return <ErrorMessage>An error happend when query protocol parameters.</ErrorMessage>;

  const nativeScriptSet = cardano.lib.NativeScripts.new()
  nativeScriptSet.add(script)

  return (
    <Layout>
      <div className='space-y-2'>
        <NativeScriptInfoViewer
          cardano={cardano}
          className='border-t-4 border-sky-700 bg-white rounded shadow overflow-hidden p-4 space-y-1'
          script={script} />
        <NewTransaction
          changeAddress={address}
          cardano={cardano}
          utxos={data.utxos}
          nativeScriptSet={nativeScriptSet}
          protocolParameters={protocolParameters} />
      </div>
    </Layout>
  )
}

const GetTreasury: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query
  const cardano = useCardanoMultiplatformLib()

  if (!cardano) return <Loading />;
  if (typeof base64CBOR !== 'string') return <ErrorMessage>Invalid script</ErrorMessage>;
  const parseResult = getResult(() => cardano.lib.NativeScript.from_bytes(Buffer.from(base64CBOR, 'base64')))
  if (!parseResult.isOk) return <ErrorMessage>Invalid script</ErrorMessage>;
  const script = parseResult.data

  return <GetUTxOsToSpend
    cardano={cardano}
    script={script} />
}

export default GetTreasury
