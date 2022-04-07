import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout } from '../../../components/layout'
import { Cardano } from '../../../cardano/serialization-lib'
import { getResult, useCardanoSerializationLib } from '../../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../../components/status'
import { useContext } from 'react'
import { ConfigContext } from '../../../cardano/config'
import { NativeScriptInfoViewer, NewTransaction } from '../../../components/transaction'
import { useAddressUTxOsQuery, useProtocolParametersQuery } from '../../../cardano/query-api'
import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { ShelleyProtocolParams } from '@cardano-graphql/client-ts'

const NewMultiSigTransaction: NextPage<{
  cardano: Cardano
  protocolParameters: ShelleyProtocolParams
  script: NativeScript
}> = ({ cardano, protocolParameters, script }) => {

  const [config, _] = useContext(ConfigContext)
  const address = cardano.getScriptAddress(script, config.isMainnet)
  const { loading, error, data } = useAddressUTxOsQuery(address.to_bech32())

  if (loading) return <Loading />;
  if (error) return <ErrorMessage>An error happened when query balance.</ErrorMessage>;

  const utxos = data?.utxos
  if (!utxos) return <Loading />;

  const nativeScriptSet = cardano.lib.NativeScripts.new()
  nativeScriptSet.add(script)

  return (
    <Layout>
      <div className='space-y-2'>
        <NativeScriptInfoViewer
          className='border-t-4 border-sky-700 bg-white rounded shadow overflow-hidden p-4 space-y-1'
          script={script} />
        <NewTransaction
          changeAddress={address}
          cardano={cardano}
          utxos={utxos}
          nativeScriptSet={nativeScriptSet}
          protocolParameters={protocolParameters} />
      </div>
    </Layout>
  )
}

const GetTreasury: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query
  const cardano = useCardanoSerializationLib()
  const { loading, error, data } = useProtocolParametersQuery()

  if (!cardano) return <Loading />;
  if (typeof base64CBOR !== 'string') return <ErrorMessage>Invalid script</ErrorMessage>;
  const parseResult = getResult(() => cardano.lib.NativeScript.from_bytes(Buffer.from(base64CBOR, 'base64')))
  if (!parseResult.isOk) return <ErrorMessage>Invalid script</ErrorMessage>;
  const script = parseResult.data
  if (loading) return <Loading />;
  if (error) return <ErrorMessage>An error happened when query protocol parameters.</ErrorMessage>;

  const params = data?.cardano?.currentEpoch?.protocolParams
  if (!params) return <Loading />;

  return <NewMultiSigTransaction
    cardano={cardano}
    protocolParameters={params}
    script={script} />
}

export default GetTreasury
