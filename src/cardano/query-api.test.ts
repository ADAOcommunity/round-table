import { renderHook } from '@testing-library/react-hooks'
import { Config } from './config'
import { getAssetName, getPolicyId, useProtocolParametersQuery } from './query-api'
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
    tapeNameGenerator: (tapeNumber) => ['graphql', `protocol-parameters-${tapeNumber}`].join('/')
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
})
