import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Hero, Layout } from '../../../components/layout'
import { Cardano, encodeCardanoData } from '../../../cardano/serialization-lib'
import { getResult, useCardanoSerializationLib } from '../../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../../components/status'
import { useContext } from 'react'
import { ConfigContext } from '../../../cardano/config'
import { NativeScriptViewer, NewTransaction } from '../../../components/transaction'
import type { ProtocolParameters } from '../../../cardano/query-api'
import { useAddressUTxOsQuery, useProtocolParametersQuery } from '../../../cardano/query-api'
import type { NativeScript } from '@adaocommunity/cardano-serialization-lib-browser'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../db'

const NewMultiSigTransaction: NextPage<{
  cardano: Cardano
  protocolParameters: ProtocolParameters
  script: NativeScript
}> = ({ cardano, protocolParameters, script }) => {

  const [config, _] = useContext(ConfigContext)
  const address = cardano.getScriptAddress(script, config.isMainnet)

  const treasury = useLiveQuery(async () => db.treasuries.get(encodeCardanoData(script, 'base64')))

  const utxos = useAddressUTxOsQuery(address.to_bech32(), config)
  if (utxos.type === 'loading') return <Loading />;
  if (utxos.type === 'error') return <ErrorMessage>An error happened when query balance.</ErrorMessage>;

  const nativeScriptSet = cardano.lib.NativeScripts.new()
  nativeScriptSet.add(script)

  return (
    <Layout>
      <div className='space-y-2'>
        <Hero>
          <h1 className='font-semibold text-lg'>{treasury?.name || 'No name'}</h1>
          {treasury?.description &&
            <article className='whitespace-pre-line'>
              {treasury?.description}
            </article>
          }
        </Hero>
        <NativeScriptViewer cardano={cardano} script={script} />
        <NewTransaction
          changeAddress={address}
          cardano={cardano}
          utxos={utxos.data}
          nativeScriptSet={nativeScriptSet}
          protocolParameters={protocolParameters} />
      </div>
    </Layout>
  )
}

const Treasury: NextPage = () => {
  const [config, _] = useContext(ConfigContext)
  const router = useRouter()
  const { base64CBOR } = router.query
  const cardano = useCardanoSerializationLib()
  const protocolParameters = useProtocolParametersQuery(config)

  if (!cardano) return <Loading />;
  if (typeof base64CBOR !== 'string') return <ErrorMessage>Invalid script</ErrorMessage>;
  const parseResult = getResult(() => cardano.lib.NativeScript.from_bytes(Buffer.from(base64CBOR, 'base64')))
  if (!parseResult.isOk) return <ErrorMessage>Invalid script</ErrorMessage>;
  const script = parseResult.data
  if (protocolParameters.type === 'loading') return <Loading />;
  if (protocolParameters.type === 'error') return <ErrorMessage>An error happened when query protocol parameters.</ErrorMessage>;

  return <NewMultiSigTransaction
    cardano={cardano}
    protocolParameters={protocolParameters.data}
    script={script} />
}

export default Treasury
