import { createContext } from 'react'

type GraphQL = {
  type: 'graphql'
  URI: string
}

type QueryAPI = GraphQL

type Network = 'mainnet' | 'testnet' | 'preview'

const parseNetwork = (text: string): Network => {
  switch (text) {
    case 'mainnet': return 'mainnet'
    case 'testnet': return 'testnet'
    case 'preview': return 'preview'
    default: throw new Error('Unknown network')
  }
}

type Config = {
  network: Network
  queryAPI: QueryAPI
  submitAPI: string[]
  SMASH: string
  gunPeers: string[]
  autoSync: boolean
}

const isMainnet = (config: Config) => config.network === 'mainnet'

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
const defaultSMASHMainnet = 'https://mainnet-smash.panl.org'
const defaultSMASHTestnet = 'https://preview-smash.panl.org'

const defaultConfig: Config = {
  network: 'mainnet',
  queryAPI: { type: 'graphql', URI: defaultGraphQLMainnet },
  submitAPI: defaultSubmitURIMainnet,
  SMASH: defaultSMASHMainnet,
  gunPeers: [],
  autoSync: true,
}

const createConfig = (): Config => {
  const network = parseNetwork(process.env.NEXT_PUBLIC_NETWORK ?? 'mainnet')
  const defaultGraphQL = network === 'mainnet' ? defaultGraphQLMainnet : defaultGraphQLTestnet
  const defaultSubmitURI = network === 'mainnet' ? defaultSubmitURIMainnet : defaultSubmitURITestnet
  const grapQLURI = process.env.NEXT_PUBLIC_GRAPHQL ?? defaultGraphQL
  const submitEnv = process.env.NEXT_PUBLIC_SUBMIT
  const submitURI = submitEnv ? submitEnv.split(';') : defaultSubmitURI
  const defaultSMASH = network === 'mainnet' ? defaultSMASHMainnet : defaultSMASHTestnet
  const SMASH = process.env.NEXT_PUBLIC_SMASH ?? defaultSMASH
  const gunPeers = (process.env.NEXT_PUBLIC_GUN ?? '').split(';')

  return {
    network,
    queryAPI: { type: 'graphql', URI: grapQLURI },
    submitAPI: submitURI,
    SMASH,
    gunPeers,
    autoSync: true
  }
}

const config = createConfig()

const ConfigContext = createContext<[Config, (x: Config) => void]>([defaultConfig, (_) => {}])

export type { Config, Network }
export { ConfigContext, config, isMainnet }
