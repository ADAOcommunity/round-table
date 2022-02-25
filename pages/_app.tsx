import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useState } from 'react'
import { Config, ConfigContext, defaultConfig } from '../components/config'

function MyApp({ Component, pageProps }: AppProps) {
  const [config, setConfig] = useState<Config>(defaultConfig)

  return (
    <ConfigContext.Provider value={[config, setConfig]}>
      <Component {...pageProps} />
    </ConfigContext.Provider>
  )
}

export default MyApp
