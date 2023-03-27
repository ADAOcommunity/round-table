import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config, isMainnet, defaultGraphQLURI } from '../cardano/config'
import Head from 'next/head'
import { NotificationContext, useNotification } from '../components/notification'
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { GraphQLURIContext } from '../cardano/query-api'
import { useCallback, useEffect, useMemo, useState } from 'react'

function MyApp({ Component, pageProps }: AppProps) {
  const notification = useNotification()
  const title = useMemo(() => isMainnet(config) ? 'RoundTable' : `RoundTable ${config.network}`, [])
  const configContext = useState(config)
  const [graphQLURI, setGraphQLURI] = useState(defaultGraphQLURI)
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
  const updateGraphQLURI = useCallback((uri: string) => {
    const trimmed = uri.trim()
    if (trimmed.length > 0) {
      window.localStorage.setItem('GraphQLURI', trimmed)
      setGraphQLURI(trimmed)
    } else {
      setGraphQLURI(defaultGraphQLURI)
      window.localStorage.removeItem('GraphQLURI')
    }
  }, [])
  const graphQLContext: [string, (uri: string) => void] = useMemo(() => [graphQLURI, updateGraphQLURI], [graphQLURI, updateGraphQLURI])
  useEffect(() => {
    const uri = window.localStorage.getItem('GraphQLURI')
    if (uri) {
      setGraphQLURI(uri)
    }
  }, [])

  return (
    <ConfigContext.Provider value={configContext}>
      <GraphQLURIContext.Provider value={graphQLContext}>
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
