import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config } from '../cardano/config'
import Head from 'next/head'
import { NotificationContext, useNotification } from '../components/notification'
import { ApolloProvider } from '@apollo/client'
import { createApolloClient } from '../cardano/query-api'
import { useState } from 'react'
import { SystemTimeContext } from '../components/time'

const apolloClient = createApolloClient(config)

function MyApp({ Component, pageProps }: AppProps) {
  const notification = useNotification()
  const systemTimeState = useState<Date>(new Date())

  return (
    <ConfigContext.Provider value={[config, () => { }]}>
      <NotificationContext.Provider value={notification}>
        <ApolloProvider client={apolloClient}>
          <SystemTimeContext.Provider value={systemTimeState}>
            <Head>
              <title>{config.isMainnet ? 'RoundTable' : 'RoundTable Testnet'}</title>
            </Head>
            <Component {...pageProps} />
          </SystemTimeContext.Provider>
        </ApolloProvider>
      </NotificationContext.Provider>
    </ConfigContext.Provider>
  )
}

export default MyApp
