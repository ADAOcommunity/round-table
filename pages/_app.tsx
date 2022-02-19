import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useState } from 'react'
import { NetworkContext } from '../components/network-switch'

function MyApp({ Component, pageProps }: AppProps) {
  const networkState = useState(true)

  return (
    <NetworkContext.Provider value={networkState}>
      <Component {...pageProps} />
    </NetworkContext.Provider>
  )
}

export default MyApp
