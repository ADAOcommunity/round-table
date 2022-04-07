import { gql, useQuery, ApolloClient, InMemoryCache, HttpLink } from '@apollo/client'
import type { Cardano, TransactionOutput } from '@cardano-graphql/client-ts'
import fetch from 'cross-fetch'

const getPolicyId = (assetId: string) => assetId.slice(0, 56)
const getAssetName = (assetId: string) => assetId.slice(56)

type Assets = Map<string, bigint>

type Value = {
  lovelace: bigint
  assets: Assets
}

const getBalance = (utxos: TransactionOutput[]): Value => {
  const assets: Assets = new Map()

  utxos && utxos.forEach((utxo) => {
    utxo.tokens.forEach(({ asset, quantity }) => {
      const { policyId, assetName } = asset
      const id = policyId + assetName
      const value = (assets.get(id) ?? BigInt(0)) + BigInt(quantity)
      assets.set(id, value)
    })
  })

  return {
    lovelace: utxos.map(({ value }) => BigInt(value)).reduce((acc, v) => acc + v, BigInt(0)),
    assets
  }
}

const UTxOsQuery = gql`
query UTxOsByAddress($address: String!) {
  utxos(where: { address: { _eq: $address } }) {
    address
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

const useAddressUTxOsQuery = (address: string) => useQuery<{ utxos: TransactionOutput[] }>(UTxOsQuery, { variables: { address } })

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

const useProtocolParametersQuery = () => useQuery<{ cardano: Cardano }>(ProtocolParametersQuery)

const createApolloClient = (uri: string) => new ApolloClient({
  link: new HttpLink({ uri, fetch }),
  cache: new InMemoryCache()
})

export type { Value }
export { createApolloClient, getBalance, getPolicyId, getAssetName, useAddressUTxOsQuery, useProtocolParametersQuery }
