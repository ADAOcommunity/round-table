import { renderHook, waitFor } from '@testing-library/react'
import { getAssetName, getPolicyId, useUTxOSummaryQuery, usePaymentAddressesQuery, sumValues, useSummaryQuery, useTransactionSummaryQuery, useStakePoolsQuery } from './query-api'
import type { Value } from './query-api'
import talkback from 'talkback/es6'
import { ApolloProvider } from '@apollo/client'
import type { FC, ReactNode } from 'react'
import fetch from 'cross-fetch'
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client'

const policyId = '126b8676446c84a5cd6e3259223b16a2314c5676b88ae1c1f8579a8f'
const assetName = '7453554e444145'
const assetId = policyId + assetName

const createApolloClient = (uri: string) => new ApolloClient({
  link: new HttpLink({ uri, fetch }),
  cache: new InMemoryCache()
})

test('sumValues', () => {
  const valueA: Value = { lovelace: BigInt(100), assets: new Map() }
  const valueB: Value = { lovelace: BigInt(1000), assets: new Map([['token1', BigInt(10)]]) }
  const valueC: Value = { lovelace: BigInt(50), assets: new Map([['token1', BigInt(1)], ['token2', BigInt(100)]]) }
  const total = sumValues([valueA, valueB, valueC])
  expect(total.lovelace).toBe(BigInt(1150))
  expect(total.assets.size).toBe(2)
  expect(total.assets.get('token1')).toBe(BigInt(11))
  expect(total.assets.get('token2')).toBe(BigInt(100))
})

test('getAssetName', () => {
  expect(getAssetName(assetId)).toBe(assetName)
})

test('getPolicyId', () => {
  expect(getPolicyId(assetId)).toBe(policyId)
})

describe('GraphQL API', () => {
  const client = createApolloClient('http://localhost:8080')
  const wrapper: FC<{ children: ReactNode }> = ({ children }) => <ApolloProvider client={client}>{children}</ApolloProvider>;

  const talkbackServer = talkback({
    host: 'https://preview-gql.junglestakepool.com/graphql',
    port: 8080,
    tapeNameGenerator: (tapeNumber) => ['graphql', `query-${tapeNumber}`].join('/')
  })

  beforeAll(() => talkbackServer.start())
  afterAll(() => talkbackServer.close())

  test('useUTxOSummaryQuery', async () => {
    const address = 'addr_test1xzuh59uc243wuhpkcnfdha3flvmx5guf8thkctv8l75u2zzap4eefgsu8h5selu2aaeu29vh96rf99wcp5f0x60ldx6s2ad79j'
    const rewardAddress = 'stake_test17pws6uu55gwrm6gvl79w7u79zktjap5jjhvq6yhnd8lkndgcsn5h4'
    const { result } = renderHook(() => useUTxOSummaryQuery({ variables: { addresses: [address], rewardAddress } }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 })

    const { data } = result.current

    expect(data).toBeTruthy()

    if (data) {
      const utxos = data.utxos
      expect(utxos.length).toBe(4)

      const utxo1 = utxos[0]
      expect(utxo1.address).toBe(address)
      expect(utxo1.txHash).toBe('3ec64a8784bddc1b1849a349fe88c01918a58e4d32636420c17aafe156f16f9c')
      expect(utxo1.value).toBe('969750')
      expect(utxo1.tokens.length).toBe(0)
      expect(utxo1.index).toBe(0)

      const utxo2 = utxos[1]
      expect(utxo2.address).toBe(address)
      expect(utxo2.txHash).toBe('829c0c98a4037f214abe197276ef8b53be3e313b139e73a87f7a8d0ff70ff735')
      expect(utxo2.value).toBe('10000000')
      expect(utxo2.tokens.length).toBe(1)
      expect(utxo2.index).toBe(0)

      const utxo3 = utxos[2]
      expect(utxo3.address).toBe(address)
      expect(utxo3.txHash).toBe('42e1b09014989a06633ca999c6a5bb20724af4773e725567d138cecca24fc800')
      expect(utxo3.value).toBe('1000000')
      expect(utxo3.tokens.length).toBe(0)
      expect(utxo3.index).toBe(0)

      const { cardano, delegations, stakeRegistrations_aggregate, stakeDeregistrations_aggregate, withdrawals_aggregate, rewards_aggregate } = data

      expect(delegations).toHaveLength(1)
      expect(stakeRegistrations_aggregate.aggregate?.count).toBe('1')
      expect(stakeDeregistrations_aggregate.aggregate?.count).toBe('0')
      expect(withdrawals_aggregate.aggregate?.sum.amount).toBe('1612692')
      expect(rewards_aggregate.aggregate?.sum.amount).toBe('1709889')

      const params = cardano.currentEpoch.protocolParams
      if (params) {
        expect(params.minFeeA).toBe(44)
        expect(params.minFeeB).toBe(155381)
        expect(params.poolDeposit).toBe(500000000)
        expect(params.coinsPerUtxoByte).toBe(4310)
        expect(params.keyDeposit).toBe(2000000)
        expect(params.maxTxSize).toBe(16384)
        expect(params.maxValSize).toBe('5000')
        expect(params.priceMem).toBe(0.0577)
        expect(params.priceStep).toBe(0.0000721)
        expect(params.collateralPercent).toBe(150)
        expect(params.maxCollateralInputs).toBe(3)
      }
    }
  })

  test('useSummaryQuery', async () => {
    const address = 'addr_test1xzuh59uc243wuhpkcnfdha3flvmx5guf8thkctv8l75u2zzap4eefgsu8h5selu2aaeu29vh96rf99wcp5f0x60ldx6s2ad79j'
    const rewardAddress = 'stake_test17pws6uu55gwrm6gvl79w7u79zktjap5jjhvq6yhnd8lkndgcsn5h4'
    const { result } = renderHook(() => useSummaryQuery({ variables: { addresses: [address], rewardAddress } }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 })

    const { data } = result.current

    expect(result.current.data).toBeTruthy()

    if (data) {
      const paymentAddresses = data.paymentAddresses
      expect(paymentAddresses.length).toBe(1)
      const summary = paymentAddresses[0].summary
      if (summary) {
        expect(summary.assetBalances.length).toBe(2)
        expect(summary.assetBalances[0]?.asset.assetId).toBe('ada')
        expect(summary.assetBalances[0]?.quantity).toBe('1009250494')
        expect(summary.assetBalances[1]?.asset.assetId).toBe('9a556a69ba07adfbbce86cd9af8fd73f60fcf43c73f8deb51d2176b4504855464659')
        expect(summary.assetBalances[1]?.quantity).toBe('1')
      }

      const { delegations, stakeRegistrations_aggregate, stakeDeregistrations_aggregate, withdrawals_aggregate, rewards_aggregate } = data

      expect(delegations).toHaveLength(1)
      expect(stakeRegistrations_aggregate.aggregate?.count).toBe('1')
      expect(stakeDeregistrations_aggregate.aggregate?.count).toBe('0')
      expect(withdrawals_aggregate.aggregate?.sum.amount).toBe('1612692')
      expect(rewards_aggregate.aggregate?.sum.amount).toBe('1709889')
    }
  })

  test('usePaymentAddressesQuery', async () => {
    const address = 'addr_test1xzuh59uc243wuhpkcnfdha3flvmx5guf8thkctv8l75u2zzap4eefgsu8h5selu2aaeu29vh96rf99wcp5f0x60ldx6s2ad79j'
    const { result } = renderHook(() => usePaymentAddressesQuery({ variables: { addresses: [address] } }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 })

    const { data } = result.current

    if (data) {
      const paymentAddresses = data.paymentAddresses
      expect(paymentAddresses.length).toBe(1)
      const summary = paymentAddresses[0].summary
      if (summary) {
        expect(summary.assetBalances.length).toBe(2)
        expect(summary.assetBalances[0]?.asset.assetId).toBe('ada')
        expect(summary.assetBalances[0]?.quantity).toBe('1009250494')
        expect(summary.assetBalances[1]?.asset.assetId).toBe('9a556a69ba07adfbbce86cd9af8fd73f60fcf43c73f8deb51d2176b4504855464659')
        expect(summary.assetBalances[1]?.quantity).toBe('1')
      }
    }
  })

  test('useTransactionSummaryQuery', async () => {
    const txHash = '829c0c98a4037f214abe197276ef8b53be3e313b139e73a87f7a8d0ff70ff735'
    const { result } = renderHook(() => useTransactionSummaryQuery({ variables: { hashes: [txHash] } }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 })

    const { data } = result.current

    if (data) {
      const { transactions } = data
      expect(transactions).toHaveLength(1)
      expect(transactions[0].hash).toEqual(txHash)
      expect(transactions[0].outputs).toHaveLength(3)
      expect(transactions[0].outputs[0]?.index).toBe(2)
      expect(transactions[0].outputs[0]?.value).toBe('8949377793')
      expect(transactions[0].outputs[0]?.tokens).toHaveLength(0)
      expect(transactions[0].outputs[1]?.index).toBe(1)
      expect(transactions[0].outputs[2]?.index).toBe(0)
    }
  })

  test('useStakePoolsQuery', async () => {
    const poolId = 'pool1ayc7a29ray6yv4hn7ge72hpjafg9vvpmtscnq9v8r0zh7azas9c'
    const { result } = renderHook(() => useStakePoolsQuery({ variables: { id: poolId, limit: 1, offset: 0 } }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 })

    const { data } = result.current

    if (data) {
      const { stakePools } = data
      expect(stakePools).toHaveLength(1)
      expect(stakePools[0].id).toBe(poolId)
      expect(stakePools[0].hash).toBe('e931eea8a3e9344656f3f233e55c32ea5056303b5c313015871bc57f')
    }
  })
})
