import { renderHook, waitFor } from '@testing-library/react'
import { getAssetName, getPolicyId, useGetUTxOsToSpendQuery, usePaymentAddressesQuery } from './query-api'
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
    host: 'https://graphql-api.testnet.dandelion.link',
    port: 8080,
    tapeNameGenerator: (tapeNumber) => ['graphql', `query-${tapeNumber}`].join('/')
  })

  beforeAll(() => talkbackServer.start())
  afterAll(() => talkbackServer.close())

  test('useGetUTxOsToSpendQuery', async () => {
    const address = 'addr_test1qqtsc3a28ypaya0nwymxx0v2n2yj59tar4d9dfzrv304fs99yppznn3rkcelva8hl56f2td3v526w7fdra3vlj2kva6qn2hna4'
    const { result } = renderHook(() => useGetUTxOsToSpendQuery({ variables: { addresses: [address] } }), { wrapper })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 })

    expect(result.current.data).toBeTruthy()

    if (result.current.data) {
      const utxos = result.current.data.utxos
      expect(utxos.length).toBe(2)

      const utxo1 = utxos[0]
      expect(utxo1.address).toBe(address)
      expect(utxo1.txHash).toBe('b2ff4a748f249c1535a8bfb0259d4c83576cdf710e514a1014af85e01e58a5bd')
      expect(utxo1.value).toBe('1413762')
      expect(utxo1.tokens.length).toBe(2)
      expect(utxo1.index).toBe(0)

      const utxo2 = utxos[1]
      expect(utxo2.address).toBe(address)
      expect(utxo2.txHash).toBe('8800af315253480dbd61c2eed1c4a6014d0cfddfbbb2686dae34af8b3bdc15bd')
      expect(utxo2.value).toBe('1000000')
      expect(utxo2.tokens.length).toBe(0)
      expect(utxo2.index).toBe(0)

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
    const address = 'addr_test1qqtsc3a28ypaya0nwymxx0v2n2yj59tar4d9dfzrv304fs99yppznn3rkcelva8hl56f2td3v526w7fdra3vlj2kva6qn2hna4'
    const { result } = renderHook(() => usePaymentAddressesQuery({ variables: { addresses: [address] } }), { wrapper })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 })

    if (result.current.data) {
      const paymentAddresses = result.current.data.paymentAddresses
      expect(paymentAddresses.length).toBe(1)
      const summary = paymentAddresses[0].summary
      if (summary) {
        expect(summary.assetBalances.length).toBe(3)
        expect(summary.assetBalances[0]?.asset.assetId).toBe('ada')
        expect(summary.assetBalances[0]?.quantity).toBe('2413762')
      }
    }
  })
})
