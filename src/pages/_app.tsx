import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config } from '../cardano/config'
import Head from 'next/head'
import { NotificationContext, useNotification } from '../components/notification'
import { ApolloProvider } from '@apollo/client'
import { createApolloClient } from '../cardano/query-api'

const apolloClient = createApolloClient(config)

function MyApp({ Component, pageProps }: AppProps) {
  const notification = useNotification()

  return (
    <ConfigContext.Provider value={[config, () => { }]}>
      <NotificationContext.Provider value={notification}>
        <ApolloProvider client={apolloClient}>
          <Head>
            <title>{config.isMainnet ? 'RoundTable (Mainnet)' : 'RoundTable (Testnet)'}</title>
            <link rel="shortcut icon" href="/marker.svg" />
          </Head>
          <Component {...pageProps} />
        </ApolloProvider>
      </NotificationContext.Provider>
    </ConfigContext.Provider>
  )
}

export default MyApp
