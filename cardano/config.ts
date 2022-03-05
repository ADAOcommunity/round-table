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

const createConfig = (): Config => {
  const isMainnet = !process.env.NEXT_PUBLIC_TESTNET
  const grapQLURI = process.env.NEXT_PUBLIC_GRAPHQL

  return {
    isMainnet,
    queryAPI: grapQLURI ? { type: 'graphql', URI: grapQLURI } : { type: 'koios' }
  }
}

const config = createConfig()

const ConfigContext = createContext<[Config, (x: Config) => void]>([defaultConfig, (_) => { }])

export type { Config }
export { ConfigContext, config }
