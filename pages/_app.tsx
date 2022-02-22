import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useState } from 'react'
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { Config, ConfigContext, defaultConfig } from '../components/config'

function MyApp({ Component, pageProps }: AppProps) {
  const [config, setConfig] = useState<Config>(defaultConfig)

  let apolloClient;
  if (config.queryAPI.type === 'graphql') {
    apolloClient = new ApolloClient({
      uri: config.queryAPI.URI,
      cache: new InMemoryCache()
    })
  }

  return (
    <ConfigContext.Provider value={[config, setConfig]}>
      {apolloClient && (
        <ApolloProvider client={apolloClient}>
          <Component {...pageProps} />
        </ApolloProvider>
      )}
      {!apolloClient && (
        <Component {...pageProps} />
      )}
    </ConfigContext.Provider>
  )
}

export default MyApp
