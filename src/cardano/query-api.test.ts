import { renderHook } from '@testing-library/react-hooks'
import { Config } from './config'
import { getAssetName, getPolicyId, useAddressUTxOsQuery, useProtocolParametersQuery } from './query-api'
import talkback from 'talkback/es6'

const policyId = '126b8676446c84a5cd6e3259223b16a2314c5676b88ae1c1f8579a8f'
const assetName = '7453554e444145'
const assetId = policyId + assetName

test('getAssetName', () => {
  expect(getAssetName(assetId)).toBe(assetName)
})

test('getPolicyId', () => {
  expect(getPolicyId(assetId)).toBe(policyId)
})

describe('GraphQL API', () => {
  const config: Config = {
    isMainnet: false,
    queryAPI: { type: 'graphql', URI: 'http://localhost:8080' }
  }

  const talkbackServer = talkback({
    host: 'https://graphql-api.testnet.dandelion.link',
    port: 8080,
    tapeNameGenerator: (tapeNumber) => ['graphql', `query-${tapeNumber}`].join('/')
  })

  beforeAll(() => talkbackServer.start())
  afterAll(() => talkbackServer.close())

  test('useProtocolParametersQuery', async () => {
    const { result, waitForValueToChange } = renderHook(() => useProtocolParametersQuery(config))

    expect(result.current.type).toBe('loading')

    await waitForValueToChange(() => result.current.type, { timeout: 10000 })

    expect(result.current.type).toBe('ok')

    if (result.current.type === 'ok') {
      const data = result.current.data
      expect(data.minFeeA).toBe(44)
      expect(data.minFeeB).toBe(155381)
      expect(data.poolDeposit).toBe(500000000)
      expect(data.coinsPerUtxoWord).toBe(34482)
      expect(data.keyDeposit).toBe(2000000)
      expect(data.maxTxSize).toBe(16384)
      expect(data.maxValSize).toBe(5000)
    }
  })

  test('useAddressUTxOsQuery', async () => {
    const address = 'addr_test1qqtsc3a28ypaya0nwymxx0v2n2yj59tar4d9dfzrv304fs99yppznn3rkcelva8hl56f2td3v526w7fdra3vlj2kva6qn2hna4'
    const { result, waitForValueToChange } = renderHook(() => useAddressUTxOsQuery(address, config))

    expect(result.current.type).toBe('loading')

    await waitForValueToChange(() => result.current.type, { timeout: 10000 })

    expect(result.current.type).toBe('ok')

    if (result.current.type === 'ok') {
      const utxos = result.current.data
      expect(utxos.length).toBe(2)
      const utxo1 = utxos[0]
      expect(utxo1.address).toBe(address)
      expect(utxo1.txHash).toBe('b2ff4a748f249c1535a8bfb0259d4c83576cdf710e514a1014af85e01e58a5bd')
      expect(utxo1.lovelace).toBe(BigInt('1413762'))
      expect(utxo1.assets.length).toBe(2)
      expect(utxo1.index).toBe(0)
      const utxo2 = utxos[1]
      expect(utxo2.address).toBe(address)
      expect(utxo2.txHash).toBe('2c79557ef628dbc64f438c80a1fe761ea2b84a999cf82808bf550651b5d0fc13')
      expect(utxo2.lovelace).toBe(BigInt('10000000'))
      expect(utxo2.assets.length).toBe(0)
      expect(utxo1.index).toBe(0)
    }
  })
})
