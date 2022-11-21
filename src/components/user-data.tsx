import { useLiveQuery } from 'dexie-react-hooks'
import type { FC, ReactNode } from 'react'
import { ChangeEventHandler, MouseEventHandler, useContext, useEffect, useState } from 'react'
import { ConfigContext } from '../cardano/config'
import { useCardanoMultiplatformLib } from '../cardano/multiplatform-lib'
import { db } from '../db'
import type { Account } from '../db'

type UserData = {
  isMainnet: boolean
  version: string
  accounts: Account[]
}

const DownloadButton: FC<{
  className?: string
  children: ReactNode
  download: string
  blobParts: BlobPart[]
  options?: BlobPropertyBag
}> = ({ blobParts, options, download, className, children }) => {
  const [URI, setURI] = useState<string | undefined>()

  useEffect(() => {
    let isMounted = true

    if (blobParts && isMounted) {
      const blob = new Blob(blobParts, options)
      setURI(window.URL.createObjectURL(blob))
    }

    return () => {
      isMounted = false
    }
  }, [blobParts, options])

  if (!URI) return null

  return (
    <a
      href={URI}
      className={className}
      download={download}>
      {children}
    </a>
  )
}

const ExportUserDataButton: FC = () => {
  const [config, _] = useContext(ConfigContext)
  const accounts = useLiveQuery(async () =>
    db.accounts.toArray()
  )
  if (!accounts) return null

  const userData: UserData = {
    isMainnet: config.isMainnet,
    version: '2',
    accounts
  }
  const filename = `roundtable-backup.${config.isMainnet ? 'mainnet' : 'testnet'}.json`

  return (
    <DownloadButton
      blobParts={[JSON.stringify(userData)]}
      options={{ type: 'application/json' }}
      className='p-2 rounded bg-sky-700 text-white'
      download={filename}>
      Export User Data
    </DownloadButton>
  )
}

const ImportUserData: FC = () => {
  const cardano = useCardanoMultiplatformLib()
  const [config, _] = useContext(ConfigContext)
  const [userDataJSON, setUserDataJSON] = useState('')

  if (!cardano) return null;

  const changeHandle: ChangeEventHandler<HTMLInputElement> = async (event) => {
    event.preventDefault()
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = (e.target?.result)
      if (typeof text !== 'string') {
        console.error('Invalid backup file')
        return
      }
      setUserDataJSON(text)
    }
    const files = event.target.files
    if (files) {
      reader.readAsText(files[0])
    }
  }

  const clickHandle: MouseEventHandler<HTMLButtonElement> = () => {
    if (!userDataJSON) return;
    const userData = JSON.parse(userDataJSON)
    if (userData.isMainnet !== config.isMainnet) return;
    importUserData(userData)
  }

  const importUserData = (userData: UserData) => {
    const version = userData.version

    if (version === '2') {
      const accounts: Account[] = userData.accounts
      db.accounts.bulkAdd(accounts)
    }
  }

  const isValid = (): boolean => {
    if (!userDataJSON) return false
    const userData = JSON.parse(userDataJSON)
    if (!userData) return false
    if (userData.isMainnet !== config.isMainnet) return false
    return true
  }

  return (
    <div className='rounded border border-sky-700 overflow-hidden'>
      <input
        type='file'
        onChange={changeHandle} />
      <button
        className='p-2 bg-sky-700 text-white disabled:text-gray-400 disabled:bg-gray-100'
        onClick={clickHandle}
        disabled={!isValid()}>
        Import User Data
      </button>
    </div>
  )
}

export { ExportUserDataButton, ImportUserData, DownloadButton }
