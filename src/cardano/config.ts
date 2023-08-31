import { createContext } from 'react'

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
  submitAPI: defaultSubmitURIMainnet,
  SMASH: defaultSMASHMainnet,
  gunPeers: [],
  autoSync: true,
}

const createConfig = (): Config => {
  const network = parseNetwork(process.env.NEXT_PUBLIC_NETWORK ?? 'mainnet')
  const defaultSubmitURI = network === 'mainnet' ? defaultSubmitURIMainnet : defaultSubmitURITestnet
  const submitEnv = process.env.NEXT_PUBLIC_SUBMIT
  const submitURI = submitEnv ? submitEnv.split(';') : defaultSubmitURI
  const defaultSMASH = network === 'mainnet' ? defaultSMASHMainnet : defaultSMASHTestnet
  const SMASH = process.env.NEXT_PUBLIC_SMASH ?? defaultSMASH
  const gunPeers = (process.env.NEXT_PUBLIC_GUN ?? '').split(';')

  return {
    network,
    submitAPI: submitURI,
    SMASH,
    gunPeers,
    autoSync: true
  }
}

const config = createConfig()

const ConfigContext = createContext<[Config, (x: Config) => void]>([defaultConfig, (_) => {}])

const defaultGraphQLURI = process.env.NEXT_PUBLIC_GRAPHQL ?? (parseNetwork(process.env.NEXT_PUBLIC_NETWORK ?? 'mainnet') === 'mainnet' ? defaultGraphQLMainnet : defaultGraphQLTestnet)

const donationAddress = (network: Network): string => {
  switch(network) {
    case 'mainnet':
      return 'addr1qy8yxxrle7hq62zgpazaj7kj36nphqyyxey62wm694dgfds5kkvr22hlffqdj63vk8nf8rje5np37v4fwlpvj4c4qryqtcla0w';
    default:
      return 'addr_test1qpe7qk82nqyd77tdqmn6q7y5ll4kwwxdajgwf3llcu4e44nmcxl09wnytjsykngrga52kqhevzv2dn67rt0876qmwn3sf7qxv3';
  }
}

export type { Config, Network }
export { ConfigContext, config, defaultGraphQLURI, donationAddress, isMainnet }
