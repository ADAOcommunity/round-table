import { ApolloClient, gql, InMemoryCache, useQuery } from '@apollo/client'
import type { QueryHookOptions, QueryResult } from '@apollo/client'
import type { Cardano, Delegation, PaymentAddress, StakePool, StakeRegistration, TransactionOutput } from '@cardano-graphql/client-ts'
import { Config } from './config'
import { StakeDeregistration } from '@dcspark/cardano-multiplatform-lib-browser'

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

const GetStakePoolsQuery = gql`
query getStakePools($id: StakePoolID, $limit: Int!, $offset: Int!) {
  stakePools(
    limit: $limit
    offset: $offset
    order_by: { margin: asc, fixedCost: asc, pledge: desc }
    where: {
      retirements: { inEffectFrom: { _is_null: false } }
      id: { _eq: $id }
    }
  ) {
    id
    margin
    fixedCost
    pledge
    hash
    metadataHash
    activeStake_aggregate {
      aggregate {
        sum {
          amount
        }
      }
    }
    blocks_aggregate {
      aggregate {
        count
      }
    }
  }
}`

const useGetStakePoolsQuery: Query<
  { stakePools: StakePool[] },
  { id?: string, limit: number, offset: number }
> = (options) => useQuery(GetStakePoolsQuery, options)

const GetDelegationQuery = gql`
query getDelegation($address: String!, $rewardAddress: StakeAddress!) {
  stakeRegistrations(where: { address: { _eq: $rewardAddress } }) {
    address
  }
  stakeDeregistrations(where: { address: { _eq: $rewardAddress } }) {
    address
  }
  delegations(
    limit: 1
    order_by: {
      transaction: { block: { slotNo: desc, epoch: { number: desc } } }
    }
    where: { address: { _eq: $rewardAddress } }
  ) {
    stakePool {
      id
    }
  }
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

const useGetDelegationQuery: Query<
  {
    stakeRegistrations: StakeRegistration[],
    stakeDeregistrations: StakeDeregistration[],
    delegations: Delegation[],
    utxos: TransactionOutput[],
    cardano: Cardano
  },
  { address: string, rewardAddress: string }
> = (options) => useQuery(GetDelegationQuery, options)


export type { Value }
export { createApolloClient, getBalanceByUTxOs, getPolicyId, getAssetName, getBalanceByPaymentAddresses, useGetUTxOsToSpendQuery, usePaymentAddressesQuery, useGetStakePoolsQuery, useGetDelegationQuery }
