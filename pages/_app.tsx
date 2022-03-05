import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config } from '../cardano/config'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ConfigContext.Provider value={[config, () => { }]}>
      <Component {...pageProps} />
    </ConfigContext.Provider>
  )
}

export default MyApp
