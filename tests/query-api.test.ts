import { getAssetName, getPolicyId } from '../cardano/query-api'

const policyId = '126b8676446c84a5cd6e3259223b16a2314c5676b88ae1c1f8579a8f'
const assetName = '7453554e444145'
const assetId = policyId + assetName

test('getAssetName', () => {
  expect(getAssetName(assetId)).toBe(assetName)
})

test('getPolicyID', () => {
  expect(getPolicyId(assetId)).toBe(policyId)
})
