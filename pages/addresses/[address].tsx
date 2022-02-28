import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { ConfigContext } from '../../cardano/config'
import Layout from '../../components/layout'
import { useContext } from 'react'
import { NewTransaction } from '../../components/transaction'
import { toADA } from '../../components/currency'
import { useAddressBalanceQuery } from '../../cardano/query-api'

const GetAddress: NextPage = () => {
  const router = useRouter()
  const { address } = router.query
  const [config, _] = useContext(ConfigContext)
  const { loading, error, balance } = useAddressBalanceQuery(address as string, config)

  if (error) return <div>An error happened.</div>

  if (loading) return (
    <div className='text-center'>
      Loading...
    </div>
  )

  if (balance) {
    return (
      <Layout>
        <div className='p-4 rounded-md bg-white my-2'>
          <h1 className='font-medium text-center'>{address}</h1>
          <h2 className='font-medium text-center text-lg'>{toADA(balance.value.lovelace)}&nbsp;₳</h2>
        </div>
        <NewTransaction balance={balance} />
      </Layout>
    )
  } else {
    return <div>No content</div>
  }
}

export default GetAddress
