import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config, isMainnet } from '../cardano/config'
import Head from 'next/head'
import { NotificationContext, useNotification } from '../components/notification'
import { ApolloProvider } from '@apollo/client'
import { createApolloClient } from '../cardano/query-api'
import { useState } from 'react'
import { DateContext } from '../components/time'

const apolloClient = createApolloClient(config)

function MyApp({ Component, pageProps }: AppProps) {
  const notification = useNotification()
  const dateState = useState<Date>(new Date())

  return (
    <ConfigContext.Provider value={[config, () => {}]}>
      <NotificationContext.Provider value={notification}>
        <ApolloProvider client={apolloClient}>
          <DateContext.Provider value={dateState}>
            <Head>
              <title>RoundTable{isMainnet(config) ? '' : ` ${config.network}` }</title>
            </Head>
            <Component {...pageProps} />
          </DateContext.Provider>
        </ApolloProvider>
      </NotificationContext.Provider>
    </ConfigContext.Provider>
  )
}

export default MyApp
