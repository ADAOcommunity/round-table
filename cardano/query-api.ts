import { gql, ApolloClient, InMemoryCache } from '@apollo/client'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { Config } from './config'

type Assets = Map<string, bigint>

type TxOutput = {
  txHash: string
  index: number
}

type Value = {
  lovelace: bigint
  assets: Assets
}

type Balance = { txOutputs: TxOutput[], value: Value }

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
            value: {
              lovelace: utxos.map(({ value }) => BigInt(value)).reduce((acc, v) => acc + v, BigInt(0)),
              assets
            }
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
              value: {
                lovelace: BigInt(info.balance),
                assets: assets
              }
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

export type { Balance, Value }
export { useAddressBalanceQuery }
