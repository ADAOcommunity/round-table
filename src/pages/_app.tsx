import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config, isMainnet } from '../cardano/config'
import Head from 'next/head'
import { NotificationContext, useNotification } from '../components/notification'
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { GraphQLURIContext } from '../cardano/query-api'
import { useMemo, useState } from 'react'

function MyApp({ Component, pageProps }: AppProps) {
  const notification = useNotification()
  const title = useMemo(() => isMainnet(config) ? 'RoundTable' : `RoundTable ${config.network}`, [])
  const configContext = useState(config)
  const [graphQLURI, setGraphQLURI] = useState(config.queryAPI.URI)
  const apolloClient = useMemo(() => new ApolloClient({
    uri: graphQLURI,
    cache: new InMemoryCache({
      typePolicies: {
        PaymentAddress: {
          keyFields: ['address']
        }
      }
    })
  }), [graphQLURI])

  return (
    <ConfigContext.Provider value={configContext}>
      <GraphQLURIContext.Provider value={[graphQLURI, setGraphQLURI]}>
        <NotificationContext.Provider value={notification}>
          <ApolloProvider client={apolloClient}>
            <Head>
              <title>{title}</title>
            </Head>
            <Component {...pageProps} />
          </ApolloProvider>
        </NotificationContext.Provider>
      </GraphQLURIContext.Provider>
    </ConfigContext.Provider>
  )
}

export default MyApp
