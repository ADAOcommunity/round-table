import { useLiveQuery } from 'dexie-react-hooks'
import type { FC, ReactNode } from 'react'
import { ChangeEventHandler, MouseEventHandler, useContext, useEffect, useState } from 'react'
import { ConfigContext } from '../cardano/config'
import { useCardanoMultiplatformLib } from '../cardano/multiplatform-lib'
import { db } from '../db'
import type { MultisigWallet } from '../db'

type UserData = {
  network: string
  version: string
  multisigWallets: MultisigWallet[]
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
  const multisigWallets = useLiveQuery(async () =>
    db.multisigWallets.toArray()
  )
  if (!multisigWallets) return null

  const userData: UserData = {
    network: config.network,
    version: '2',
    multisigWallets
  }
  const filename = `roundtable-backup.${config.network}.json`

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
    if (userData.network !== config.network) return;
    importUserData(userData)
  }

  const importUserData = (userData: UserData) => {
    const version = userData.version

    if (version === '2') {
      const multisigWallets: MultisigWallet[] = userData.multisigWallets
      db.multisigWallets.bulkAdd(multisigWallets)
    }
  }

  const isValid = (): boolean => {
    if (!userDataJSON) return false
    const userData = JSON.parse(userDataJSON)
    if (!userData) return false
    if (userData.network !== config.network) return false
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
