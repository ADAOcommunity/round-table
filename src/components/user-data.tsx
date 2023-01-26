import { useLiveQuery } from 'dexie-react-hooks'
import { useContext, useEffect, useState, useMemo, useCallback } from 'react'
import type { FC, ChangeEventHandler, MouseEventHandler, ReactNode } from 'react'
import { ConfigContext } from '../cardano/config'
import { db } from '../db'
import type { MultisigWallet, PersonalWallet, KeyHashIndex } from '../db'
import type { Network } from '../cardano/config'
import { NotificationContext } from './notification'

type UserData = {
  network: Network
  version: '2'
  multisigWallets: MultisigWallet[]
  personalWallets: PersonalWallet[]
  keyHashIndices: KeyHashIndex[]
}

const serializeUserData = (userData: UserData): string => {
  return JSON.stringify(userData, (_key, value) => {
    if (value instanceof Map) return {
      dataType: 'Map',
      data: Array.from(value.entries())
    }
    if (value instanceof Uint8Array) return {
      dataType: 'Uint8Array',
      encoding: 'base64',
      data: Buffer.from(value).toString('base64')
    }
    return value
  })
}

const deserializeUserData = (content: string): UserData => {
  return JSON.parse(content, (_key, value) => {
    if (value.dataType === 'Map') return new Map(value.data)
    if (value.dataType === 'Uint8Array') return new Uint8Array(Buffer.from(value.data, 'base64'))
    return value
  })
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
    if (blobParts) {
      const blob = new Blob(blobParts, options)
      setURI(window.URL.createObjectURL(blob))
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
  const personalWallets = useLiveQuery(async () =>
    db.personalWallets.toArray()
  )
  const keyHashIndices = useLiveQuery(async () =>
    db.keyHashIndices.toArray()
  )
  const userData: UserData | undefined = useMemo(() => {
    if (!multisigWallets || !personalWallets || !keyHashIndices) return

    return {
      network: config.network,
      version: '2',
      multisigWallets,
      personalWallets,
      keyHashIndices
    }
  }, [multisigWallets, personalWallets, keyHashIndices, config.network])
  const filename = useMemo(() => `roundtable-backup.${config.network}.json`, [config.network])

  if (!userData) return null

  return (
    <DownloadButton
      blobParts={[serializeUserData(userData)]}
      options={{ type: 'application/json' }}
      className='p-2 rounded bg-sky-700 text-white'
      download={filename}>
      Export User Data
    </DownloadButton>
  )
}

const ImportUserData: FC = () => {
  const [config, _] = useContext(ConfigContext)
  const { notify } = useContext(NotificationContext)
  const [userDataJSON, setUserDataJSON] = useState('')

  const change: ChangeEventHandler<HTMLInputElement> = useCallback(async (event) => {
    event.preventDefault()
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = (e.target?.result)
      if (typeof text !== 'string') {
        notify('error', 'Invalid backup file')
        return
      }
      setUserDataJSON(text)
    }
    const files = event.target.files
    if (files) {
      reader.readAsText(files[0])
    }
  }, [notify])

  const click: MouseEventHandler<HTMLButtonElement> = useCallback(() => {
    if (!userDataJSON) return;
    const userData = deserializeUserData(userDataJSON)
    if (userData.network !== config.network) {
      notify('error', `Wrong network: ${userData.network}`)
      return
    }
    if (userData.version !== '2') {
      notify('error', 'Incompatible version. Please recreate wallets and then migrate.')
      return
    }
    if (userData.version === '2') {
      db.transaction('rw', db.multisigWallets, db.personalWallets, db.keyHashIndices, async () => {
        await db.multisigWallets.bulkAdd(userData.multisigWallets)
        await db.personalWallets.bulkAdd(userData.personalWallets)
        return db.keyHashIndices.bulkAdd(userData.keyHashIndices)
      }).catch((error) => {
        console.error(error)
        notify('error', 'Failed to import, check the error in console.')
      })
    }
  }, [userDataJSON, notify, config.network])

  return (
    <div className='flex rounded border border-sky-700 overflow-hidden items-center'>
      <input
        type='file'
        onChange={change} />
      <button
        className='p-2 bg-sky-700 text-white disabled:text-gray-400 disabled:bg-gray-100'
        onClick={click}>
        Import
      </button>
    </div>
  )
}

export type { UserData }
export { ExportUserDataButton, ImportUserData, DownloadButton, serializeUserData, deserializeUserData }
