import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout, Panel } from '../../components/layout'
import { Cardano, CardanoSet, mapCardanoSet } from '../../cardano/serialization-lib'
import { getResult, useCardanoSerializationLib } from '../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../components/status'
import { useContext } from 'react'
import { ConfigContext } from '../../cardano/config'
import { NewTransaction } from '../../components/transaction'
import type { ProtocolParameters } from '../../cardano/query-api'
import { useAddressUTxOsQuery, useProtocolParametersQuery } from '../../cardano/query-api'
import type { Ed25519KeyHash, NativeScript } from '@emurgo/cardano-serialization-lib-browser'

const NewMultiSigTransaction: NextPage<{
  cardano: Cardano
  protocolParameters: ProtocolParameters
  script: NativeScript
}> = ({ cardano, protocolParameters, script }) => {

  const [config, _] = useContext(ConfigContext)
  const address = cardano.getScriptAddress(script, config.isMainnet)

  const utxos = useAddressUTxOsQuery(address.to_bech32(), config)
  if (utxos.type === 'loading') return <Loading />;
  if (utxos.type === 'error') return <ErrorMessage>An error happened when query balance.</ErrorMessage>;

  const nativeScriptSet = cardano.lib.NativeScripts.new()
  nativeScriptSet.add(script)

  const requiredSigners: CardanoSet<Ed25519KeyHash> = script.get_required_signers()

  return (
    <Layout>
      <div className='space-y-2'>
        <h1 className='my-8 font-bold text-2xl text-center'>Treasury - Proposal</h1>
        <Panel title='Native Script'>
          <div className='p-4 text-center font-mono'>
            <h3 className='mb-2'>{address.to_bech32()}</h3>
            <ul className='text-gray-500'>
              {mapCardanoSet(requiredSigners, (keyHash, index) =>
                <li key={index}>{Buffer.from(keyHash.to_bytes()).toString('hex')}</li>
              )}
            </ul>
          </div>
        </Panel>
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
