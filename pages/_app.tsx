import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config } from '../cardano/config'
import Head from 'next/head'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ConfigContext.Provider value={[config, () => { }]}>
      <Head>
        <title>{config.isMainnet ? 'MultiSig (Mainnet)' : 'MultiSig (Testnet)'}</title>
      </Head>
      <Component {...pageProps} />
    </ConfigContext.Provider>
  )
}

export default MyApp
