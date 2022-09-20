import { createContext } from 'react'

type GraphQL = {
  type: 'graphql'
  URI: string
}

type QueryAPI = GraphQL

type Config = {
  isMainnet: boolean
  queryAPI: QueryAPI
  submitAPI: string[]
  gunPeers: string[]
}

const defaultGraphQLMainnet = 'https://d.graphql-api.mainnet.dandelion.link'
const defaultGraphQLTestnet = 'https://d.graphql-api.testnet.dandelion.link'
const defaultSubmitURIMainnet = [
  'https://adao.panl.org',
  'https://submit-api.apexpool.info/api/submit/tx'
]
const defaultSubmitURITestnet = [
  'https://testrelay1.panl.org',
  'https://relay1-testnet.apexpool.info/api/submit/tx'
]

const defaultConfig: Config = {
  isMainnet: true,
  queryAPI: { type: 'graphql', URI: defaultGraphQLMainnet },
  submitAPI: defaultSubmitURIMainnet,
  gunPeers: []
}

const createConfig = (): Config => {
  const isMainnet = !process.env.NEXT_PUBLIC_TESTNET
  const defaultGraphQL = isMainnet ? defaultGraphQLMainnet : defaultGraphQLTestnet
  const defaultSubmitURI = isMainnet ? defaultSubmitURIMainnet : defaultSubmitURITestnet
  const grapQLURI = process.env.NEXT_PUBLIC_GRAPHQL ?? defaultGraphQL
  const submitEnv = process.env.NEXT_PUBLIC_SUBMIT
  const submitURI = submitEnv ? submitEnv.split(';') : defaultSubmitURI
  const gunPeers = (process.env.NEXT_PUBLIC_GUN ?? '').split(';')

  return {
    isMainnet,
    queryAPI: { type: 'graphql', URI: grapQLURI },
    submitAPI: submitURI,
    gunPeers
  }
}

const config = createConfig()

const ConfigContext = createContext<[Config, (x: Config) => void]>([defaultConfig, (_) => { }])

export type { Config }
export { ConfigContext, config }
