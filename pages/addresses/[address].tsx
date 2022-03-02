import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { ConfigContext } from '../../cardano/config'
import Layout from '../../components/layout'
import { useContext } from 'react'
import { NewTransaction } from '../../components/transaction'
import { useAddressUTxOsQuery, useProtocolParametersQuery } from '../../cardano/query-api'
import { useCardanoSerializationLib } from '../../cardano/serialization-lib'

const GetAddress: NextPage = () => {
  const router = useRouter()
  const { address } = router.query
  const [config, _] = useContext(ConfigContext)
  const utxos = useAddressUTxOsQuery(address as string, config)
  const cardano = useCardanoSerializationLib()
  const protocolParameters = useProtocolParametersQuery(config)

  const Loading = () => (
    <div className='text-center'>
      Loading...
    </div>
  )

  if (!cardano) return <div className='text-center'>Loading Cardano Serialization Lib</div>
  if (utxos.type === 'loading') return <Loading />
  if (protocolParameters.type === 'loading') return <Loading />
  if (utxos.type === 'error') return <div>An error happened when query balance.</div>
  if (protocolParameters.type === 'error') return <div>An error happened when query protocol parameters.</div>
  if (!address) return <div>No address</div>
  if (typeof address !== 'string') return <div>Multiple addresses</div>

  const addressResult = cardano.buildAddress(address)
  if (!addressResult.isOk) return <div>Invalid Bech32 address</div>

  return (
    <Layout>
      <div className='p-4 rounded-md bg-white my-2'>
        <h1 className='font-medium text-center'>{address}</h1>
      </div>
      <NewTransaction senderAddress={addressResult.data} cardano={cardano} protocolParameters={protocolParameters.data} utxos={utxos.data} />
    </Layout>
  )
}

export default GetAddress
