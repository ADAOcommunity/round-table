import { createContext } from 'react'

type GraphQL = {
  type: 'graphql'
  URI: string
}

type Blockfrost = {
  type: 'blockfrost'
  projectId: string
}

type QueryAPI = GraphQL | Blockfrost

type Config = {
  isMainnet: boolean
  queryAPI: QueryAPI
}

const defaultConfig: Config = {
  isMainnet: true,
  queryAPI: { type: 'graphql', URI: 'https://graphql-api.mainnet.dandelion.link' }
}

const ConfigContext = createContext<[Config, (x: Config) => void]>([defaultConfig, (_) => { }])

export type { Config }
export { ConfigContext, defaultConfig }
