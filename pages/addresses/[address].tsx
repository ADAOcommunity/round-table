import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { ConfigContext } from '../../cardano/config'
import Layout from '../../components/layout'
import { useContext } from 'react'
import { NewTransaction } from '../../components/transaction'
import { useAddressUTxOsQuery, useProtocolParametersQuery } from '../../cardano/query-api'
import { useCardanoSerializationLib } from '../../cardano/serialization-lib'
import { ErrorPage, LoadingPage } from '../../components/status'

const GetAddress: NextPage = () => {
  const router = useRouter()
  const { address } = router.query
  const [config, _] = useContext(ConfigContext)
  const utxos = useAddressUTxOsQuery(address as string, config)
  const cardano = useCardanoSerializationLib()
  const protocolParameters = useProtocolParametersQuery(config)

  const loading = <LoadingPage><p className='p-8 text-lg text-gray-900'>Loading...</p></LoadingPage>
  const ErrorMessage: NextPage = ({ children }) => <p className='p-4 font-bold text-lg text-red-600'>{children}</p>

  if (!cardano) return <div className='text-center'>Loading Cardano Serialization Lib</div>
  if (utxos.type === 'loading') return loading
  if (protocolParameters.type === 'loading') return loading
  if (utxos.type === 'error') return (
    <ErrorPage>
      <ErrorMessage>An error happened when query balance.</ErrorMessage>
    </ErrorPage>
  )
  if (protocolParameters.type === 'error') return (
    <ErrorPage>
      <ErrorMessage>An error happened when query protocol parameters.</ErrorMessage>
    </ErrorPage>
  )
  if (!address || typeof address !== 'string') return (
    <ErrorPage>
      <ErrorMessage>Invalid address</ErrorMessage>
    </ErrorPage>
  )
  const addressResult = cardano.buildAddress(address)
  if (!addressResult.isOk) return (
    <ErrorPage>
      <ErrorMessage>Invalid address</ErrorMessage>
    </ErrorPage>
  )

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
