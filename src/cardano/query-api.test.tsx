import { renderHook } from '@testing-library/react-hooks'
import { getAssetName, getPolicyId, useGetUTxOsToSpendQuery, usePaymentAddressesQuery } from './query-api'
import talkback from 'talkback/es6'
import { ApolloProvider } from '@apollo/client'
import { NextPage } from 'next'
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
  const wrapper: NextPage = ({ children }) => <ApolloProvider client={client}>{children}</ApolloProvider>;

  const talkbackServer = talkback({
    host: 'https://graphql-api.testnet.dandelion.link',
    port: 8080,
    tapeNameGenerator: (tapeNumber) => ['graphql', `query-${tapeNumber}`].join('/')
  })

  beforeAll(() => talkbackServer.start())
  afterAll(() => talkbackServer.close())

  test('useGetUTxOsToSpendQuery', async () => {
    const address = 'addr_test1qqtsc3a28ypaya0nwymxx0v2n2yj59tar4d9dfzrv304fs99yppznn3rkcelva8hl56f2td3v526w7fdra3vlj2kva6qn2hna4'
    const { result, waitForValueToChange } = renderHook(() => useGetUTxOsToSpendQuery({ variables: { addresses: [address] } }), { wrapper })

    expect(result.current.loading).toBe(true)

    await waitForValueToChange(() => result.current.loading, { timeout: 10000 })

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeTruthy()

    if (result.current.data) {
      const utxos = result.current.data.utxos
      expect(utxos.length).toBe(2)

      const utxo1 = utxos[0]
      expect(utxo1.address).toBe(address)
      expect(utxo1.txHash).toBe('2c79557ef628dbc64f438c80a1fe761ea2b84a999cf82808bf550651b5d0fc13')
      expect(utxo1.value).toBe('10000000')
      expect(utxo1.tokens.length).toBe(0)
      expect(utxo1.index).toBe(0)

      const utxo2 = utxos[1]
      expect(utxo2.address).toBe(address)
      expect(utxo2.txHash).toBe('b2ff4a748f249c1535a8bfb0259d4c83576cdf710e514a1014af85e01e58a5bd')
      expect(utxo2.value).toBe('1413762')
      expect(utxo2.tokens.length).toBe(2)
      expect(utxo2.index).toBe(0)

      const params = result.current.data.cardano.currentEpoch.protocolParams
      if (params) {
        expect(params.minFeeA).toBe(44)
        expect(params.minFeeB).toBe(155381)
        expect(params.poolDeposit).toBe(500000000)
        expect(params.coinsPerUtxoWord).toBe(34482)
        expect(params.keyDeposit).toBe(2000000)
        expect(params.maxTxSize).toBe(16384)
        expect(params.maxValSize).toBe('5000')
      }
    }
  })

  test('usePaymentAddressesQuery', async () => {
    const address = 'addr_test1qqtsc3a28ypaya0nwymxx0v2n2yj59tar4d9dfzrv304fs99yppznn3rkcelva8hl56f2td3v526w7fdra3vlj2kva6qn2hna4'
    const { result, waitForValueToChange } = renderHook(() => usePaymentAddressesQuery({ variables: { addresses: [address] } }), { wrapper })

    expect(result.current.loading).toBe(true)

    await waitForValueToChange(() => result.current.loading, { timeout: 10000 })

    expect(result.current.loading).toBe(false)

    if (result.current.data) {
      const paymentAddresses = result.current.data.paymentAddresses
      expect(paymentAddresses.length).toBe(1)
      const summary = paymentAddresses[0].summary
      if (summary) {
        expect(summary.assetBalances.length).toBe(3)
        expect(summary.assetBalances[0]?.asset.assetId).toBe('ada')
        expect(summary.assetBalances[0]?.quantity).toBe('11413762')
      }
    }
  })
})
