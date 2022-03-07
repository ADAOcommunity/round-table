import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { ConfigContext } from '../../cardano/config'
import { Layout } from '../../components/layout'
import { useContext } from 'react'
import { NewTransaction } from '../../components/transaction'
import { useAddressUTxOsQuery, useProtocolParametersQuery } from '../../cardano/query-api'
import { useCardanoSerializationLib } from '../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../components/status'

const GetAddress: NextPage = () => {
  const router = useRouter()
  const { address } = router.query
  const [config, _] = useContext(ConfigContext)
  const utxos = useAddressUTxOsQuery(address as string, config)
  const cardano = useCardanoSerializationLib()
  const protocolParameters = useProtocolParametersQuery(config)

  if (!cardano) return <Loading />;
  if (utxos.type === 'loading') return <Loading />;
  if (protocolParameters.type === 'loading') return <Loading />;
  if (utxos.type === 'error') return <ErrorMessage>An error happened when query balance.</ErrorMessage>;
  if (protocolParameters.type === 'error') return <ErrorMessage>An error happened when query protocol parameters.</ErrorMessage>;
  if (typeof address !== 'string') return <ErrorMessage>Invalid address</ErrorMessage>;
  const addressResult = cardano.parseAddress(address);
  if (!addressResult.isOk) return <ErrorMessage>Invalid address</ErrorMessage>;

  return (
    <Layout>
      <div className='p-4 rounded-md bg-white my-2'>
        <h1 className='font-medium text-center'>{address}</h1>
      </div>
      <NewTransaction
        senderAddress={addressResult.data}
        cardano={cardano}
        protocolParameters={protocolParameters.data}
        previewURI={(body) => `/proposals/${body}`}
        utxos={utxos.data} />
    </Layout>
  )
}

export default GetAddress
