import { createContext } from 'react'

type GraphQL = {
  type: 'graphql'
  URI: string
}

type QueryAPI = GraphQL

type Network = 'mainnet' | 'testnet'

type Config = {
  isMainnet: boolean
  network: Network
  queryAPI: QueryAPI
  submitAPI: string[]
  SMASH: string
  gunPeers: string[]
}

const defaultGraphQLMainnet = 'https://d.graphql-api.mainnet.dandelion.link'
const defaultGraphQLTestnet = 'https://graphql.preview.lidonation.com/graphql'
const defaultSubmitURIMainnet = [
  'https://adao.panl.org',
  'https://submit-api.apexpool.info/api/submit/tx'
]
const defaultSubmitURITestnet = [
  'https://sa-preview.apexpool.info/api/submit/tx',
  'https://preview-submit.panl.org'
]
const defaultSMASHMainnet = 'https://smash.cardano-mainnet.iohk.io/api/v1'
const defaultSMASHTestnet = 'https://preview-smash.panl.org'

const defaultConfig: Config = {
  isMainnet: true,
  network: 'mainnet',
  queryAPI: { type: 'graphql', URI: defaultGraphQLMainnet },
  submitAPI: defaultSubmitURIMainnet,
  SMASH: defaultSMASHMainnet,
  gunPeers: []
}

const parseNetwork = (text: string): Network => {
  switch (text) {
    case 'mainnet': return 'mainnet'
    case 'testnet': return 'testnet'
    default: throw new Error('Unknown network')
  }
}

const createConfig = (): Config => {
  const isMainnet = !process.env.NEXT_PUBLIC_TESTNET
  const network = parseNetwork(process.env.NEXT_PUBLIC_NETWORK ?? 'mainnet')
  const defaultGraphQL = isMainnet ? defaultGraphQLMainnet : defaultGraphQLTestnet
  const defaultSubmitURI = isMainnet ? defaultSubmitURIMainnet : defaultSubmitURITestnet
  const grapQLURI = process.env.NEXT_PUBLIC_GRAPHQL ?? defaultGraphQL
  const submitEnv = process.env.NEXT_PUBLIC_SUBMIT
  const submitURI = submitEnv ? submitEnv.split(';') : defaultSubmitURI
  const defaultSMASH = isMainnet ? defaultSMASHMainnet : defaultSMASHTestnet
  const SMASH = process.env.NEXT_PUBLIC_SMASH ?? defaultSMASH
  const gunPeers = (process.env.NEXT_PUBLIC_GUN ?? '').split(';')

  return {
    isMainnet,
    network,
    queryAPI: { type: 'graphql', URI: grapQLURI },
    submitAPI: submitURI,
    SMASH,
    gunPeers
  }
}

const config = createConfig()

const ConfigContext = createContext<[Config, (x: Config) => void]>([defaultConfig, (_) => {}])

export type { Config, Network }
export { ConfigContext, config }
