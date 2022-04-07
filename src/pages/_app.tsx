import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config } from '../cardano/config'
import Head from 'next/head'
import { NotificationContext, useNotification } from '../components/notification'
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'

function MyApp({ Component, pageProps }: AppProps) {
  const notification = useNotification()

  const apolloClient = new ApolloClient({
    uri: config.queryAPI.URI,
    cache: new InMemoryCache()
  })

  return (
    <ConfigContext.Provider value={[config, () => { }]}>
      <NotificationContext.Provider value={notification}>
        <ApolloProvider client={apolloClient}>
          <Head>
            <title>{config.isMainnet ? 'RoundTable (Mainnet)' : 'RoundTable (Testnet)'}</title>
          </Head>
          <Component {...pageProps} />
        </ApolloProvider>
      </NotificationContext.Provider>
    </ConfigContext.Provider>
  )
}

export default MyApp
