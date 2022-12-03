import { renderHook, waitFor } from '@testing-library/react'
import { getAssetName, getPolicyId, useUTxOSummaryQuery, usePaymentAddressesQuery, sumValues } from './query-api'
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
    host: 'https://graphql.preview.lidonation.com/graphql',
    port: 8080,
    tapeNameGenerator: (tapeNumber) => ['graphql', `query-${tapeNumber}`].join('/')
  })

  beforeAll(() => talkbackServer.start())
  afterAll(() => talkbackServer.close())

  test('useGetUTxOsToSpendQuery', async () => {
    const address = 'addr_test1xp0q958nx63fw7uyy9e72e4s8lm25mpvpncpwc3m449d2qfv8zud6pr2g03jgerxmyv0w57e5ps85cgfh98ftsqeh3hqj0xp4c'
    const rewardAddress = 'stake_test17qkr3wxaq34y8ceyv3ndjx8h20v6qcr6vyymjn54cqvmcmsjjtmn6'
    const { result } = renderHook(() => useUTxOSummaryQuery({ variables: { addresses: [address], rewardAddress } }), { wrapper })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 })

    expect(result.current.data).toBeTruthy()

    if (result.current.data) {
      const utxos = result.current.data.utxos
      expect(utxos.length).toBe(1)

      const utxo1 = utxos[0]
      expect(utxo1.address).toBe(address)
      expect(utxo1.txHash).toBe('92670d0a30104f5f61b2b52274f8661b88832207e2a722228325fa101ef20178')
      expect(utxo1.value).toBe('10000000')
      expect(utxo1.tokens.length).toBe(1)
      expect(utxo1.index).toBe(0)

      const params = result.current.data.cardano.currentEpoch.protocolParams
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

  test('usePaymentAddressesQuery', async () => {
    const address = 'addr_test1xp0q958nx63fw7uyy9e72e4s8lm25mpvpncpwc3m449d2qfv8zud6pr2g03jgerxmyv0w57e5ps85cgfh98ftsqeh3hqj0xp4c'
    const { result } = renderHook(() => usePaymentAddressesQuery({ variables: { addresses: [address] } }), { wrapper })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 })

    if (result.current.data) {
      const paymentAddresses = result.current.data.paymentAddresses
      expect(paymentAddresses.length).toBe(1)
      const summary = paymentAddresses[0].summary
      if (summary) {
        expect(summary.assetBalances.length).toBe(2)
        expect(summary.assetBalances[0]?.asset.assetId).toBe('ada')
        expect(summary.assetBalances[0]?.quantity).toBe('10000000')
        expect(summary.assetBalances[1]?.asset.assetId).toBe('9a556a69ba07adfbbce86cd9af8fd73f60fcf43c73f8deb51d2176b4504855464659')
        expect(summary.assetBalances[1]?.quantity).toBe('1')
      }
    }
  })
})
