import { gql, useQuery } from '@apollo/client'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import Layout from '../../components/layout'

const UTxOsQuery = gql`
query UTxOsByAddress($address: String!) {
  utxos(
    where: {
      address: {
        _eq: $address
      }
    }
  ) {
    txHash
    index
    value
    tokens {
      asset {
        policyId
        assetName
        name
        ticker
        decimals
      }
      quantity
    }
  }
}
`

type Asset = {
  policyId: string
  assetName: string
  name: string
  ticker: string
  decimals: number
}

type Token = {
  asset: Asset
  quantity: string
}

type UTxO = {
  txHash: string
  index: number
  value: string
  tokens: Token[]
}

type QueryData = {
  utxos: UTxO[]
}

type QueryVars = {
  address: string
}

const lovelaceValueOf = (utxos: UTxO[]): number => {
  return utxos.map(({ value }) => parseInt(value)).reduce((p, c) => p + c, 0)
}

const Script: NextPage = () => {
  const router = useRouter()
  const { script } = router.query
  const { loading, error, data } = useQuery<QueryData, QueryVars>(UTxOsQuery, {
    variables: { address: script as string }
  })

  if (loading) return (
    <div className='text-center'>
      Loading...
    </div>
  )

  if (error) return <div>{error}</div>

  return (
    <Layout>
      <div className='p-4 rounded-md bg-white'>
        <h1 className='font-medium text-center'>{script}</h1>
        <h2 className='font-medium text-center text-lg'>{data && lovelaceValueOf(data.utxos) / 1e6}&nbsp;₳</h2>
      </div>
    </Layout>
  )
}

export default Script
