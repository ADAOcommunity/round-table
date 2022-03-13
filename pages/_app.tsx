import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ConfigContext, config } from '../cardano/config'
import Head from 'next/head'
import { useState } from 'react'
import { Notification, NotificationContext, NotificationType } from '../components/notification'
import { nanoid } from 'nanoid'

function MyApp({ Component, pageProps }: AppProps) {
  const [notifications, setNotificaitons] = useState<Notification[]>([])

  const notify = (type: NotificationType, message: string) => {
    setNotificaitons(notifications.concat({ id: nanoid(), type, message }))
  }

  const dismissHandle = (id: string) => {
    setNotificaitons(notifications.filter((notification) => notification.id !== id))
  }

  return (
    <ConfigContext.Provider value={[config, () => { }]}>
      <NotificationContext.Provider value={{ notifications, notify, dismissHandle }}>
        <Head>
          <title>{config.isMainnet ? 'MultiSig (Mainnet)' : 'MultiSig (Testnet)'}</title>
        </Head>
        <Component {...pageProps} />
      </NotificationContext.Provider>
    </ConfigContext.Provider>
  )
}

export default MyApp
