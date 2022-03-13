import { NextPage } from "next"
import { CheckCircleIcon, XCircleIcon, XIcon } from '@heroicons/react/solid'
import { createContext, useContext, useEffect, useState } from "react"
import { ProgressBar } from "./status"

type NotificationType = 'success' | 'error'

type Notification = {
  id: string
  type: NotificationType,
  message: string
}

const NotificationContext = createContext<{
  notifications: Notification[]
  notify: (type: NotificationType, message: string) => void
  dismissHandle: (id: string) => void
}>({
  notifications: [],
  notify: (_: NotificationType, __: string) => { },
  dismissHandle: (_: string) => { }
})

const NotificationIcon: NextPage<{
  type: NotificationType
}> = ({ type }) => {
  const className = 'h-4 w-4'

  switch (type) {
    case 'success': return <CheckCircleIcon className={className} />;
    case 'error': return <XCircleIcon className={className} />;
  }
}

const Notification: NextPage<{
  notification: Notification
  dismissHandle: (id: string) => any
}> = ({ notification, dismissHandle }) => {
  const { id, type, message } = notification
  const [progress, setProgress] = useState(100)
  const [intervalID, setIntervalID] = useState<NodeJS.Timer | undefined>(undefined)

  const startTimerHandle = () => {
    const id = setInterval(() => {
      setProgress((prev) => {
        if (prev > 0) {
          return prev - 0.1
        }
        return 0
      })
    }, 20)

    setIntervalID(id)
  }

  const pauseTimerHandle = () => {
    intervalID && clearInterval(intervalID)
  }

  useEffect(() => {
    let isMounted = true

    isMounted && startTimerHandle()

    return () => {
      isMounted = false
      pauseTimerHandle()
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    if (isMounted && progress <= 0) {
      pauseTimerHandle()
      dismissHandle(id)
    }

    return () => {
      isMounted = false
    }
  }, [progress])

  const getClassName = (): string => {
    const base = 'rounded-md shadow overflow-hidden relative'

    switch (type) {
      case 'success': return `${base} bg-green-100 text-green-500`
      case 'error': return `${base} bg-red-100 text-red-500`
    }
  }

  const getProgressBarClassName = (): string => {
    const base = `h-1`

    switch (type) {
      case 'success': return `${base} bg-green-500 text-green-500`
      case 'error': return `${base} bg-red-500 text-red-500`
    }
  }

  return (
    <div className={getClassName()} onMouseEnter={pauseTimerHandle} onMouseLeave={startTimerHandle}>
      <div className='p-2 flex items-center space-x-1'>
        <div><NotificationIcon type={type} /></div>
        <div className='grow break-all'>{message}</div>
        <button onClick={() => dismissHandle(id)}><XIcon className='h-4 w-4' /></button>
      </div>
      <div className='absolute bottom-0 left-0 right-0'>
        <ProgressBar className={getProgressBarClassName()} value={progress} max={100} />
      </div>
    </div>
  )
}

const NotificationCenter: NextPage<{
  className: string
}> = ({ className }) => {
  const { notifications, dismissHandle } = useContext(NotificationContext)

  return (
    <ul className={className}>
      {notifications.map((notification) =>
        <li key={notification.id}>
          <Notification notification={notification} dismissHandle={dismissHandle} />
        </li>
      )}
    </ul>
  )
}

export type { Notification, NotificationType }
export { NotificationCenter, NotificationContext }
