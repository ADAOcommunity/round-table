import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config } from '../cardano/config'
import Head from 'next/head'
import { NotificationContext, useNotification } from '../components/notification'
import { ApolloProvider } from '@apollo/client'
import { ChainStatusContext, createApolloClient } from '../cardano/query-api'
import { useState } from 'react'
import { Cardano } from '@cardano-graphql/client-ts'

const apolloClient = createApolloClient(config)

function MyApp({ Component, pageProps }: AppProps) {
  const notification = useNotification()
  const chainStatus = useState<Cardano | undefined>(undefined)

  return (
    <ConfigContext.Provider value={[config, () => { }]}>
      <NotificationContext.Provider value={notification}>
        <ApolloProvider client={apolloClient}>
          <ChainStatusContext.Provider value={chainStatus}>
            <Head>
              <title>{config.isMainnet ? 'RoundTable' : 'RoundTable Testnet'}</title>
            </Head>
            <Component {...pageProps} />
          </ChainStatusContext.Provider>
        </ApolloProvider>
      </NotificationContext.Provider>
    </ConfigContext.Provider>
  )
}

export default MyApp
