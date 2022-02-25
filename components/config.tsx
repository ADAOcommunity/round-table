import { createContext } from 'react'

type GraphQL = {
  type: 'graphql'
  URI: string
}

type Koios = {
  type: 'koios'
}

type QueryAPI = GraphQL | Koios

type Config = {
  isMainnet: boolean
  queryAPI: QueryAPI
}

const defaultConfig: Config = {
  isMainnet: true,
  queryAPI: { type: 'koios' }
}

const ConfigContext = createContext<[Config, (x: Config) => void]>([defaultConfig, (_) => { }])

export type { Config }
export { ConfigContext, defaultConfig }
