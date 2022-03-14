import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config } from '../cardano/config'
import Head from 'next/head'
import { NotificationContext, useNotification } from '../components/notification'

function MyApp({ Component, pageProps }: AppProps) {
  const notification = useNotification()

  return (
    <ConfigContext.Provider value={[config, () => { }]}>
      <NotificationContext.Provider value={notification}>
        <Head>
          <title>{config.isMainnet ? 'MultiSig (Mainnet)' : 'MultiSig (Testnet)'}</title>
        </Head>
        <Component {...pageProps} />
      </NotificationContext.Provider>
    </ConfigContext.Provider>
  )
}

export default MyApp
