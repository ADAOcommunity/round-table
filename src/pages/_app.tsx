import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config } from '../cardano/config'
import Head from 'next/head'
import { NotificationContext, useNotification } from '../components/notification'
import { ApolloProvider } from '@apollo/client'
import { createApolloClient } from '../cardano/query-api'
import { useState } from 'react'
import { DateContext } from '../components/time'
import type { Account } from '../db'
import { CurrentAccountContext } from '../components/account'

const apolloClient = createApolloClient(config)

function MyApp({ Component, pageProps }: AppProps) {
  const notification = useNotification()
  const dateState = useState<Date>(new Date())
  const currentAccountState = useState<Account | undefined>()

  return (
    <ConfigContext.Provider value={[config, () => { }]}>
      <NotificationContext.Provider value={notification}>
        <ApolloProvider client={apolloClient}>
          <DateContext.Provider value={dateState}>
            <CurrentAccountContext.Provider value={currentAccountState}>
              <Head>
                <title>{config.isMainnet ? 'RoundTable' : 'RoundTable Testnet'}</title>
              </Head>
              <Component {...pageProps} />
            </CurrentAccountContext.Provider>
          </DateContext.Provider>
        </ApolloProvider>
      </NotificationContext.Provider>
    </ConfigContext.Provider>
  )
}

export default MyApp
