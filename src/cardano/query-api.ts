import { gql, useQuery } from '@apollo/client'
import type { QueryHookOptions, QueryResult } from '@apollo/client'
import type { Cardano, TransactionOutput } from '@cardano-graphql/client-ts'

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

type Query<D, V> = (options: QueryHookOptions<D, V>) => QueryResult<D, V>;
type OptionalQuery<D, V> = (options?: QueryHookOptions<D, V>) => QueryResult<D, V>;

const useAddressUTxOsQuery: Query<
  { utxos: TransactionOutput[] },
  { address: string }
> = (options) => useQuery(UTxOsQuery, options)

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

const useProtocolParametersQuery: OptionalQuery<{ cardano: Cardano }, {}> = () => useQuery(ProtocolParametersQuery)

export type { Value }
export { getBalance, getPolicyId, getAssetName, useAddressUTxOsQuery, useProtocolParametersQuery }
