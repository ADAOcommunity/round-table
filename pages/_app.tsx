import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useState } from 'react'
import { NetworkContext } from '../components/network-switch'
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'

function MyApp({ Component, pageProps }: AppProps) {
  const [isMainnet, setMainnet] = useState(true)

  const network = isMainnet ? 'mainnet' : 'testnet'
  const graphQLURI = `https://graphql-api.${network}.dandelion.link/`
  const apolloClient = new ApolloClient({
    uri: graphQLURI,
    cache: new InMemoryCache()
  })

  return (
    <NetworkContext.Provider value={[isMainnet, setMainnet]}>
      <ApolloProvider client={apolloClient}>
        <Component {...pageProps} />
      </ApolloProvider>
    </NetworkContext.Provider>
  )
}

export default MyApp
