import { gql, ApolloClient, InMemoryCache } from '@apollo/client'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { Config } from './config'

const getKoiosHost = ({ isMainnet }: Config) => isMainnet ? 'api.koios.rest' : 'testnet.koios.rest'
const createKoios = (config: Config) => axios.create({ baseURL: `https://${getKoiosHost(config)}` })

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
}`

const useAddressBalanceQuery = (address: string, config: Config) => {
  const [balance, setBalance] = useState<Balance | undefined | 'error'>(undefined)

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
        }).then(({ data }) => {
          const utxos = data?.utxos

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
        }).catch(() => {
          isMounted && setBalance('error')
        })
      }

      case 'koios': {
        const koios = createKoios(config)

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
            const info: Info = data?.[0]

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
          }).catch(() => {
            isMounted && setBalance('error')
          })
      }
    }

    return () => {
      isMounted = false
    }
  }, [address, config])

  return balance
}

type ProtocolParameters = {
  minFeeA: number
  minFeeB: number
  poolDeposit: number
  keyDeposit: number
  coinsPerUtxoWord: number
  maxValSize: string
  maxTxSize: number
}

const ProtocolParametersQuery = gql`
query getProtocolParameters {
  cardano {
    currentEpoch {
      protocolParams {
        minFeeA
        minFeeB
        poolDeposit
        keyDeposit
        coinsPerUtxoWord
        maxValSize
        maxTxSize
      }
    }
  }
}`

const useProtocolParametersQuery = (config: Config) => {
  const [protocolParameters, setProtocolParameters] = useState<ProtocolParameters | undefined | 'error'>(undefined)

  useEffect(() => {
    let isMounted = true

    switch (config.queryAPI.type) {
      case 'graphql': {
        const apollo = new ApolloClient({
          uri: config.queryAPI.URI,
          cache: new InMemoryCache()
        })

        type QueryData = {
          genesis: {
            shelley: {
              protocolParams: {
                minFeeA: number
                minFeeB: number
                poolDeposit: number
                keyDeposit: number
                coinsPerUtxoWord: number
                maxValSize: string
                maxTxSize: number
              }
            }
          }
        }

        apollo.query<QueryData>({ query: ProtocolParametersQuery }).then(({ data }) => {
          const params = data?.genesis.shelley.protocolParams

          params && isMounted && setProtocolParameters({
            minFeeA: params.minFeeA,
            minFeeB: params.minFeeB,
            poolDeposit: params.poolDeposit,
            keyDeposit: params.keyDeposit,
            coinsPerUtxoWord: params.coinsPerUtxoWord,
            maxValSize: params.maxValSize,
            maxTxSize: params.maxTxSize
          })
        }).catch(() => {
          isMounted && setProtocolParameters('error')
        })
      }

      case 'koios': {
        const koios = createKoios(config)
        koios.get('/api/v0/tip').then(({ data }) => {
          type Tip = {
            hash: string
            epoch: number
            abs_slot: number
            epoch_slot: number
            block_no: number
            block_time: string
          }
          const tip: Tip = data?.[0]
          tip && koios.get('/api/v0/epoch_params', { params: { _epoch_no: tip.epoch } }).then(({ data }) => {
            type KoiosProtocolParameters = {
              min_fee_a: number
              min_fee_b: number
              key_deposit: number
              pool_deposit: number
              coins_per_utxo_word: number
              max_val_size: number
              max_tx_size: number
            }
            const params: KoiosProtocolParameters = data?.[0]
            params && isMounted && setProtocolParameters({
              minFeeA: params.min_fee_a,
              minFeeB: params.min_fee_b,
              poolDeposit: params.pool_deposit,
              keyDeposit: params.key_deposit,
              coinsPerUtxoWord: params.coins_per_utxo_word,
              maxValSize: params.max_val_size.toString(),
              maxTxSize: params.max_tx_size
            })
          }).catch(() => {
            isMounted && setProtocolParameters('error')
          })
        }).catch(() => {
          isMounted && setProtocolParameters('error')
        })
      }
    }

    return () => {
      isMounted = false
    }
  }, [config])

  return protocolParameters
}

export type { Balance, Value, ProtocolParameters }
export { useAddressBalanceQuery, useProtocolParametersQuery }
