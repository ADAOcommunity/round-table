import { ApolloClient, gql, InMemoryCache, useQuery } from '@apollo/client'
import type { QueryHookOptions, QueryResult } from '@apollo/client'
import type { Cardano, PaymentAddress, TransactionOutput, Reward_Aggregate, Withdrawal_Aggregate, StakeRegistration_Aggregate, StakeDeregistration_Aggregate, Delegation } from '@cardano-graphql/client-ts'
import { Config } from './config'

const getPolicyId = (assetId: string) => assetId.slice(0, 56)
const getAssetName = (assetId: string) => assetId.slice(56)
const decodeASCII = (assetName: string): string => {
  return Buffer.from(assetName, 'hex').toString('ascii')
}

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

type Query<D, V> = (options: QueryHookOptions<D, V>) => QueryResult<D, V>;
type OptionalQuery<D, V> = (options?: QueryHookOptions<D, V>) => QueryResult<D, V>;

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
        coinsPerUtxoByte
        maxValSize
        maxTxSize
        priceMem
        priceStep
        collateralPercent
        maxCollateralInputs
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

const SummaryQuery = gql`
query Summary($address: String!, $rewardAddress: StakeAddress!) {
  paymentAddresses(addresses: [$address]) {
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
  rewards_aggregate(where: { address: { _eq: $rewardAddress } }) {
    aggregate {
      sum {
        amount
      }
    }
  }
  withdrawals_aggregate(where: { address: { _eq: $rewardAddress } }) {
    aggregate {
      sum {
        amount
      }
    }
  }
  stakeRegistrations_aggregate(where: { address: { _eq: $rewardAddress } }) {
    aggregate {
      count
    }
  }
  stakeDeregistrations_aggregate(where: { address: { _eq: $rewardAddress } }) {
    aggregate {
      count
    }
  }
  delegations(
    limit: 1
    order_by: { transaction: { block: { slotNo: desc } } }
    where: { address: { _eq: $rewardAddress } }
  ) {
    address
    stakePool {
      id
      url
    }
  }
}`

const useSummaryQuery: Query<
  { paymentAddresses: PaymentAddress[], rewards_aggregate: Reward_Aggregate, withdrawals_aggregate: Withdrawal_Aggregate, stakeRegistrations_aggregate: StakeRegistration_Aggregate, stakeDeregistrations_aggregate: StakeDeregistration_Aggregate, delegations: Delegation[] },
  { address: string, rewardAddress: string }
> = (options) => useQuery(SummaryQuery, options)

function getCurrentDelegation(stakeRegistrationsAggregate: StakeRegistration_Aggregate, stakeDeregistrationsAggregate: StakeDeregistration_Aggregate, delegations: Delegation[]): Delegation | undefined {
  const registrationCount = parseInt(stakeRegistrationsAggregate.aggregate?.count ?? '0')
  const deregistrationCount = parseInt(stakeDeregistrationsAggregate.aggregate?.count ?? '0')
  if (registrationCount > deregistrationCount) return delegations[0]
}

function getAvailableReward(rewardsAggregate: Reward_Aggregate, withdrawalsAggregate: Withdrawal_Aggregate): bigint {
  const rewardSum: bigint = BigInt(rewardsAggregate.aggregate?.sum.amount ?? 0)
  const withdrawalSum: bigint = BigInt(withdrawalsAggregate.aggregate?.sum.amount ?? 0)
  return rewardSum - withdrawalSum
}

export type { Value }
export { createApolloClient, decodeASCII, getBalanceByUTxOs, getPolicyId, getAssetName, getBalanceByPaymentAddresses, useGetUTxOsToSpendQuery, usePaymentAddressesQuery, useSummaryQuery, getCurrentDelegation, getAvailableReward }
