import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { ConfigContext } from '../../cardano/config'
import Layout from '../../components/layout'
import { useContext } from 'react'
import { NewTransaction } from '../../components/transaction'
import { toADA } from '../../components/currency'
import { useAddressBalanceQuery, useProtocolParametersQuery } from '../../cardano/query-api'

const GetAddress: NextPage = () => {
  const router = useRouter()
  const { address } = router.query
  const [config, _] = useContext(ConfigContext)
  const protocolParameters = useProtocolParametersQuery(config)
  const balance = useAddressBalanceQuery(address as string, config)

  const Loading = () => (
    <div className='text-center'>
      Loading...
    </div>
  )

  if (!(protocolParameters && balance)) return <Loading />
  if (balance === 'error') return <div>An error happened when query balance.</div>
  if (protocolParameters === 'error') return <div>An error happened when query protocol parameters.</div>

  if (balance && protocolParameters) {
    return (
      <Layout>
        <div className='p-4 rounded-md bg-white my-2'>
          <h1 className='font-medium text-center'>{address}</h1>
          <h2 className='font-medium text-center text-lg'>{toADA(balance.value.lovelace)}&nbsp;₳</h2>
        </div>
        <NewTransaction balance={balance} protocolParameters={protocolParameters} />
      </Layout>
    )
  } else {
    return <div>No content</div>
  }
}

export default GetAddress
