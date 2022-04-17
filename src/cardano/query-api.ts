import { ApolloClient, gql, InMemoryCache, useQuery } from '@apollo/client'
import type { QueryHookOptions, QueryResult } from '@apollo/client'
import type { Cardano, PaymentAddress, TransactionOutput } from '@cardano-graphql/client-ts'
import { Config } from './config'

const getPolicyId = (assetId: string) => assetId.slice(0, 56)
const getAssetName = (assetId: string) => assetId.slice(56)

type Assets = Map<string, bigint>

type Value = {
  lovelace: bigint
  assets: Assets
}

const getBalanceByUTxOs = (utxos: TransactionOutput[]): Value => {
  const assets: Assets = new Map()

  utxos && utxos.forEach((utxo) => {
    utxo.tokens.forEach(({ asset, quantity }) => {
      const { assetId } = asset
      const value = (assets.get(assetId) ?? BigInt(0)) + BigInt(quantity)
      assets.set(assetId, value)
    })
  })

  return {
    lovelace: utxos.map(({ value }) => BigInt(value)).reduce((acc, v) => acc + v, BigInt(0)),
    assets
  }
}

type Query<D, V> = (options: QueryHookOptions<D, V>) => QueryResult<D, V>;

const GetUTxOsToSpendQuery = gql`
query getUTxOsToSpend($addresses: [String]!) {
  utxos(where: { address: { _in: $addresses } }) {
    address
    txHash
    index
    value
    tokens {
      asset {
        assetId
      }
      quantity
    }
  }
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

const useGetUTxOsToSpendQuery: Query<
  { utxos: TransactionOutput[], cardano: Cardano },
  { addresses: string[] }
> = (options) => useQuery(GetUTxOsToSpendQuery, options)

const PaymentAddressesQuery = gql`
query PaymentAddressByAddresses($addresses: [String]!) {
  paymentAddresses(addresses: $addresses) {
    address
    summary {
      assetBalances {
        asset {
          assetId
        }
        quantity
      }
    }
  }
}`

const usePaymentAddressesQuery: Query<
  { paymentAddresses: PaymentAddress[] },
  { addresses: string[] }
> = (options) => useQuery(PaymentAddressesQuery, options)

function getBalanceByPaymentAddresses(paymentAddresses: PaymentAddress[]): Value {
  const balance: Value = {
    lovelace: BigInt(0),
    assets: new Map()
  }

  paymentAddresses.forEach((paymentAddress) => {
    paymentAddress.summary?.assetBalances?.forEach((assetBalance) => {
      if (assetBalance) {
        const { assetId } = assetBalance.asset
        const quantity = assetBalance.quantity
        if (assetId === 'ada') {
          balance.lovelace = balance.lovelace + BigInt(quantity)
          return
        }
        const value = balance.assets.get(assetId) ?? BigInt(0)
        balance.assets.set(assetId, value + BigInt(quantity))
      }
    })
  })

  return balance
}

const createApolloClient = (config: Config) => new ApolloClient({
  uri: config.queryAPI.URI,
  cache: new InMemoryCache({
    typePolicies: {
      PaymentAddress: {
        keyFields: ['address']
      }
    }
  })
})

export type { Value }
export { createApolloClient, getBalanceByUTxOs, getPolicyId, getAssetName, getBalanceByPaymentAddresses, useGetUTxOsToSpendQuery, usePaymentAddressesQuery }
