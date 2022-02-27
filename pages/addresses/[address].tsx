import { gql, ApolloClient, InMemoryCache } from '@apollo/client'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Config, ConfigContext } from '../../components/config'
import Layout from '../../components/layout'
import { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import type { Assets, Balance } from '../../components/transaction'
import { NewTransaction } from '../../components/transaction'
import { toADA } from '../../components/currency'

const UTxOsQuery = gql`
query UTxOsByAddress($address: String!) {
  utxos(
    where: {
      address: {
        _eq: $address
      }
    }) {
    txHash
    index
    value
    tokens {
      asset {
        policyId
        assetName
      }
      quantity
    }
  }
}
`

type QueryData = {
  utxos: {
    txHash: string
    index: number
    value: string
    tokens: {
      asset: {
        policyId: string
        assetName: string
      }
      quantity: string
    }[]
  }[]
}

type QueryVars = {
  address: string
}

type BalanceQuery = {
  loading: boolean
  error: boolean
  balance?: Balance
}

const useAddressBalanceQuery = (address: string, config: Config): BalanceQuery => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [balance, setBalance] = useState<Balance | undefined>(undefined)

  useEffect(() => {
    let isMounted = true

    const assets: Assets = new Map()

    switch (config.queryAPI.type) {
      case 'graphql': {
        const apollo = new ApolloClient({
          uri: config.queryAPI.URI,
          cache: new InMemoryCache()
        })

        address && apollo.query<QueryData, QueryVars>({
          query: UTxOsQuery,
          variables: { address: address }
        }).then((result) => {
          const data = result.data
          const utxos = data && data.utxos

          utxos && utxos.forEach(({ tokens }) => {
            tokens.forEach(({ asset, quantity }) => {
              const { policyId, assetName } = asset
              const key = policyId + assetName
              const value = (assets.get(key) || BigInt(0)) + BigInt(quantity)
              assets.set(key, value)
            })
          })

          isMounted && utxos && setBalance({
            txOutputs: utxos.map(({ txHash, index }) => { return { txHash, index } }),
            lovelace: utxos.map(({ value }) => BigInt(value)).reduce((acc, v) => acc + v, BigInt(0)),
            assets
          })

          isMounted && setLoading(false)
          isMounted && setError(false)
        }).catch(() => {
          isMounted && setError(true)
        })
      }

      case 'koios': {
        const host = config.isMainnet ? 'api.koios.rest' : 'testnet.koios.rest'
        const koios = axios.create({ baseURL: `https://${host}` })

        address && koios.get('/api/v0/address_info', { params: { _address: address } })
          .then(({ data }) => {
            type Info = {
              balance: string
              stake_address: string
              utxo_set: {
                tx_hash: string
                tx_index: number
                value: string
                asset_list: {
                  policy_id: string
                  asset_name: string
                  quantity: string
                }[]
              }[]
            }
            const json: Info[] = data
            const info = json[0]

            info && info.utxo_set.forEach(({ asset_list }) => {
              asset_list.forEach(({ policy_id, asset_name, quantity }) => {
                const key: string = policy_id + asset_name
                const value = (assets.get(key) || BigInt(0)) + BigInt(quantity)
                assets.set(key, value)
              })
            })

            isMounted && info && setBalance({
              txOutputs: info.utxo_set.map(({ tx_hash, tx_index }) => {
                return { txHash: tx_hash, index: tx_index }
              }),
              lovelace: BigInt(info.balance),
              assets: assets
            })

            isMounted && setLoading(false)
            isMounted && setError(false)
          }).catch(() => {
            isMounted && setError(true)
          })
      }
    }

    return () => {
      isMounted = false
    }
  }, [address, config])

  return { loading, error, balance }
}

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
          <h2 className='font-medium text-center text-lg'>{toADA(balance.lovelace)}&nbsp;₳</h2>
        </div>
        <NewTransaction balance={balance} />
      </Layout>
    )
  } else {
    return <div>No content</div>
  }
}

export default GetAddress
