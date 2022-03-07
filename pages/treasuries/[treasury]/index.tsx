import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout, Panel } from '../../../components/layout'
import type { Cardano } from '../../../cardano/serialization-lib'
import { getResult, useCardanoSerializationLib } from '../../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../../components/status'
import { useContext } from 'react'
import { ConfigContext } from '../../../cardano/config'
import { NewTransaction } from '../../../components/transaction'
import type { ProtocolParameters } from '../../../cardano/query-api'
import { useAddressUTxOsQuery, useProtocolParametersQuery } from '../../../cardano/query-api'
import type { Address, NativeScript } from '@emurgo/cardano-serialization-lib-browser'

type UTxOQueryProps = {
  address: Address
  cardano: Cardano
  protocolParameters: ProtocolParameters
  script: NativeScript
  treasury: string
}

const UTxOQuery = ({ address, cardano, protocolParameters, script, treasury }: UTxOQueryProps) => {
  const [config, _] = useContext(ConfigContext)
  const utxos = useAddressUTxOsQuery(address.to_bech32(), config)
  if (utxos.type === 'loading') return <Loading />;
  if (utxos.type === 'error') return <ErrorMessage>An error happened when query balance.</ErrorMessage>;

  return (
    <Layout>
      <div className='space-y-2'>
        <h1 className='my-8 font-bold text-2xl text-center'>Treasury - Proposal</h1>
        <Panel title='Summary'>
          <div className='p-4'>
            <p className='space-x-2'>
              <span>Address:</span>
              <span>{address.to_bech32()}</span>
            </p>
            <p className='space-x-2'>
              <span>Required Signers:</span>
              <span>{cardano.formatRequiredSigners(script)}</span>
            </p>
          </div>
        </Panel>
        <NewTransaction
          senderAddress={address}
          cardano={cardano}
          protocolParameters={protocolParameters}
          previewURI={(body) => `/treasuries/${encodeURIComponent(treasury)}/${body}`}
          utxos={utxos.data} />
      </div>
    </Layout>
  )
}

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

  return <UTxOQuery
    address={address}
    cardano={cardano}
    protocolParameters={protocolParameters.data}
    script={script}
    treasury={treasury} />
}

export default Treasury
