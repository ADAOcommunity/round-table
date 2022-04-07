import { gql, useQuery } from '@apollo/client'
import type { QueryHookOptions, QueryResult } from '@apollo/client'
import type { Cardano, PaymentAddress, TransactionOutput } from '@cardano-graphql/client-ts'

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

type Query<D, V> = (options: QueryHookOptions<D, V>) => QueryResult<D, V>;
type OptionalQuery<D, V> = (options?: QueryHookOptions<D, V>) => QueryResult<D, V>;

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

const useAddressUTxOsQuery: Query<
  { utxos: TransactionOutput[] },
  { address: string }
> = (options) => useQuery(UTxOsQuery, options)

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
export { getBalance, getPolicyId, getAssetName, getBalanceByPaymentAddresses, useAddressUTxOsQuery, useProtocolParametersQuery, usePaymentAddressesQuery }
