import { gql, useQuery } from '@apollo/client'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { ConfigContext, QueryAPI } from '../../components/config'
import Layout from '../../components/layout'
import { useContext, useEffect, useState } from 'react'

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

type AssetBalance = Map<string, bigint>

type TxOutput = {
  txHash: string
  index: number
}

type Balance = {
  txOutputs: TxOutput[]
  lovelace: bigint
  assets: AssetBalance
}

type BalanceQuery = {
  loading: boolean
  error: boolean
  balance?: Balance
}

const useBalanceQuery = (address: string, queryAPI: QueryAPI): BalanceQuery => {
  switch (queryAPI.type) {
    case 'graphql': {
      const { loading, error, data } = useQuery<QueryData, QueryVars>(UTxOsQuery, {
        variables: { address }
      })

      const assets: AssetBalance = new Map()

      const utxos = data && data.utxos

      utxos && utxos.forEach(({ tokens }) => {
        tokens.forEach(({ asset, quantity }) => {
          const key = asset.policyId + asset.assetName
          const value = (assets.get(key) || BigInt(0)) + BigInt(quantity)
          assets.set(key, value)
        })
      })

      return {
        loading,
        error: !!error,
        balance: utxos && {
          txOutputs: utxos.map(({ txHash, index }) => { return { txHash, index } }),
          lovelace: utxos.map(({ value }) => BigInt(value)).reduce((acc, v) => acc + v, BigInt(0)),
          assets
        }
      }
    }

    case 'koios': {
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState(false)
      const [balance, setBalance] = useState<Balance | undefined>(undefined)

      useEffect(() => {
        let isMounted = true

        const xhr = new XMLHttpRequest()
        const URL = `https://api.koios.rest/api/v0/address_info?_address=${address}`
        xhr.open('GET', URL)
        xhr.onload = () => {
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
          const json: Info[] | undefined = JSON.parse(xhr.response)
          const info: Info | undefined = json && json[0]
          const assets: AssetBalance = new Map()

          info && info.utxo_set.forEach(({ asset_list }) => {
            asset_list.forEach(({ policy_id, asset_name, quantity }) => {
              const key = policy_id + asset_name
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

          isMounted && info && setLoading(false)
        }
        xhr.onerror = () => {
          isMounted && setError(true)
        }
        xhr.send()

        return () => {
          isMounted = false
        }
      }, [])

      return { loading, error, balance }
    }
  }
}

const Script: NextPage = () => {
  const router = useRouter()
  const { address } = router.query
  const [config, _] = useContext(ConfigContext)
  const { loading, error, balance } = useBalanceQuery(address as string, config.queryAPI)

  if (loading) return (
    <div className='text-center'>
      Loading...
    </div>
  )

  if (error) return <div>An error happened.</div>

  const toPrecision = (value: bigint, decimals: number): string => {
    const mask = BigInt(10 ** decimals)
    const x = value / mask
    const y = value - x * mask
    return [x, y].join('.')
  }

  if (balance) {
    return (
      <Layout>
        <div className='p-4 rounded-md bg-white'>
          <h1 className='font-medium text-center'>{address}</h1>
          <h2 className='font-medium text-center text-lg'>{toPrecision(balance.lovelace, 6)}&nbsp;₳</h2>
        </div>
      </Layout>
    )
  } else {
    return <div>No content</div>
  }
}

export default Script
