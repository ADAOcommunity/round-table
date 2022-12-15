import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config, isMainnet } from '../cardano/config'
import type { Config } from '../cardano/config'
import Head from 'next/head'
import { NotificationContext, useNotification } from '../components/notification'
import { ApolloProvider } from '@apollo/client'
import { createApolloClient } from '../cardano/query-api'
import { useMemo } from 'react'

const apolloClient = createApolloClient(config)

function MyApp({ Component, pageProps }: AppProps) {
  const notification = useNotification()
  const title = useMemo(() => isMainnet(config) ? 'RoundTable' : `RoundTable ${config.network}`, [])
  const configContext: [Config, () => void] = useMemo(() => [config, () => {}], [])

  return (
    <ConfigContext.Provider value={configContext}>
      <NotificationContext.Provider value={notification}>
        <ApolloProvider client={apolloClient}>
          <Head>
            <title>{title}</title>
          </Head>
          <Component {...pageProps} />
        </ApolloProvider>
      </NotificationContext.Provider>
    </ConfigContext.Provider>
  )
}

export default MyApp
