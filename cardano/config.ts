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
  submitAPI: string
}

const getDandelionSubmitAPI = (isMainnet: boolean): string => {
  return isMainnet ? 'https://submit-api.mainnet.dandelion.link' : 'https://submit-api.testnet.dandelion.link'
}

const defaultConfig: Config = {
  isMainnet: true,
  queryAPI: { type: 'koios' },
  submitAPI: getDandelionSubmitAPI(true)
}

const createConfig = (): Config => {
  const isMainnet = !process.env.NEXT_PUBLIC_TESTNET
  const grapQLURI = process.env.NEXT_PUBLIC_GRAPHQL
  const envSubmitAPI = process.env.NEXT_PUBLIC_SUBMIT_API

  return {
    isMainnet,
    queryAPI: grapQLURI ? { type: 'graphql', URI: grapQLURI } : { type: 'koios' },
    submitAPI: envSubmitAPI ? envSubmitAPI : getDandelionSubmitAPI(isMainnet)
  }
}

const config = createConfig()

const ConfigContext = createContext<[Config, (x: Config) => void]>([defaultConfig, (_) => { }])

export type { Config }
export { ConfigContext, config }
