import { gql, useQuery } from '@apollo/client'
import type { QueryHookOptions, QueryResult } from '@apollo/client'
import type { Cardano, PaymentAddress, TransactionOutput, Reward_Aggregate, Withdrawal_Aggregate, StakeRegistration_Aggregate, StakeDeregistration_Aggregate, Delegation, StakePool, Transaction } from '@cardano-graphql/client-ts/api'
import type { Recipient } from './multiplatform-lib'
import { createContext } from 'react'

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

const sumValues = (values: Value[]): Value => values.reduce((acc, value) => {
  const assets = new Map(acc.assets)
  value.assets.forEach((quantity, id) => assets.set(id, (assets.get(id) ?? BigInt(0)) + quantity))

  return {
    lovelace: acc.lovelace + value.lovelace,
    assets
  }
}, { lovelace: BigInt(0), assets: new Map() })

const getValueFromTransactionOutput = (output: TransactionOutput): Value => {
  const assets: Assets = new Map()

  output.tokens.forEach(({ asset, quantity }) => {
    const { assetId } = asset
    const value = (assets.get(assetId) ?? BigInt(0)) + BigInt(quantity)
    assets.set(assetId, value)
  })

  return {
    lovelace: BigInt(output.value),
    assets
  }
}

const getRecipientFromTransactionOutput = (output: TransactionOutput): Recipient => {
  return {
    address: output.address,
    value: getValueFromTransactionOutput(output)
  }
}

const getBalanceByUTxOs = (utxos: TransactionOutput[]): Value => sumValues(utxos.map(getValueFromTransactionOutput))

type Query<D, V> = (options: QueryHookOptions<D, V>) => QueryResult<D, V>;

const StakePoolFields = gql`
fragment StakePoolFields on StakePool {
  id
  margin
  fixedCost
  pledge
  hash
  metadataHash
}
`

const UTxOSummaryQuery = gql`
${StakePoolFields}
query UTxOSummary($addresses: [String]!, $rewardAddress: StakeAddress!) {
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
      ...StakePoolFields
    }
  }
}
`

const useUTxOSummaryQuery: Query<
  { utxos: TransactionOutput[], cardano: Cardano, rewards_aggregate: Reward_Aggregate, withdrawals_aggregate: Withdrawal_Aggregate, stakeRegistrations_aggregate: StakeRegistration_Aggregate, stakeDeregistrations_aggregate: StakeDeregistration_Aggregate, delegations: Delegation[] },
  { addresses: string[], rewardAddress: string }
> = (options) => useQuery(UTxOSummaryQuery, options)

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
${StakePoolFields}
query Summary($addresses: [String]!, $rewardAddress: StakeAddress!) {
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
      ...StakePoolFields
    }
  }
}
`

const useSummaryQuery: Query<
  { paymentAddresses: PaymentAddress[], rewards_aggregate: Reward_Aggregate, withdrawals_aggregate: Withdrawal_Aggregate, stakeRegistrations_aggregate: StakeRegistration_Aggregate, stakeDeregistrations_aggregate: StakeDeregistration_Aggregate, delegations: Delegation[] },
  { addresses: string[], rewardAddress: string }
> = (options) => useQuery(SummaryQuery, options)

function isRegisteredOnChain(stakeRegistrationsAggregate: StakeRegistration_Aggregate, stakeDeregistrationsAggregate: StakeDeregistration_Aggregate): boolean {
  const registrationCount = BigInt(stakeRegistrationsAggregate.aggregate?.count ?? '0')
  const deregistrationCount = BigInt(stakeDeregistrationsAggregate.aggregate?.count ?? '0')
  return registrationCount > deregistrationCount
}

function getCurrentDelegation(stakeRegistrationsAggregate: StakeRegistration_Aggregate, stakeDeregistrationsAggregate: StakeDeregistration_Aggregate, delegations: Delegation[]): Delegation | undefined {
  if (isRegisteredOnChain(stakeRegistrationsAggregate, stakeDeregistrationsAggregate)) return delegations[0]
}

function getAvailableReward(rewardsAggregate: Reward_Aggregate, withdrawalsAggregate: Withdrawal_Aggregate): bigint {
  const rewardSum: bigint = BigInt(rewardsAggregate.aggregate?.sum.amount ?? 0)
  const withdrawalSum: bigint = BigInt(withdrawalsAggregate.aggregate?.sum.amount ?? 0)
  return rewardSum - withdrawalSum
}

const StakePoolRetirementFields = gql`
fragment RetirementFields on StakePool {
  retirements {
    retiredInEpoch {
      number
    }
    announcedIn {
      hash
    }
    inEffectFrom
  }
}
`

const StakePoolsQuery = gql`
${StakePoolFields}
${StakePoolRetirementFields}
query StakePools($id: StakePoolID, $limit: Int!, $offset: Int!) {
  stakePools(
    limit: $limit
    offset: $offset
    where: {
      id: { _eq: $id }
    }
  ) {
    ...StakePoolFields
    ...RetirementFields
  }
}
`

const useStakePoolsQuery: Query<
  { stakePools: StakePool[] },
  { id?: string, limit: number, offset: number }
> = (options) => useQuery(StakePoolsQuery, options)

const OutputFields = gql`
fragment OutputFields on TransactionOutput {
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
`

const TransactionSummaryQuery = gql`
${OutputFields}
query TransactionSummary($hashes: [Hash32Hex]!) {
  transactions(where: { hash: { _in: $hashes } }) {
    hash
    outputs {
      ...OutputFields
    }
  }
}
`

const useTransactionSummaryQuery: Query<
  { transactions: Transaction[] },
  { hashes: string[] }
> = (options) => useQuery(TransactionSummaryQuery, options)

type RecipientRegistry = Map<string, Map<number, Recipient>>

const collectTransactionOutputs = (transactions: Transaction[]): RecipientRegistry => transactions.reduce((collection: RecipientRegistry, transaction) => {
  const { hash, outputs } = transaction
  const subCollection: Map<number, Recipient> = collection.get(hash) ?? new Map()
  outputs.forEach((output) => {
    if (output) subCollection.set(output.index, getRecipientFromTransactionOutput(output))
  })
  return collection.set(hash, subCollection)
}, new Map())

const GraphQLURIContext = createContext<[string, (uri: string) => void]>(['', () => {}])

export type { Value, RecipientRegistry }
export { decodeASCII, getBalanceByUTxOs, getPolicyId, getAssetName, getBalanceByPaymentAddresses, useUTxOSummaryQuery, usePaymentAddressesQuery, useSummaryQuery, getCurrentDelegation, getAvailableReward, useStakePoolsQuery, isRegisteredOnChain, sumValues, useTransactionSummaryQuery, collectTransactionOutputs, GraphQLURIContext }
