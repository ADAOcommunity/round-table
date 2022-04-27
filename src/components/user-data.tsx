import { useLiveQuery } from 'dexie-react-hooks'
import type { NextPage } from 'next'
import { ChangeEventHandler, MouseEventHandler, useContext, useEffect, useState } from 'react'
import { ConfigContext } from '../cardano/config'
import { useCardanoMultiplatformLib } from '../cardano/multiplatform-lib'
import { db, Treasury } from '../db'

type UserData = {
  isMainnet: boolean
  version: string
  treasuries: {
    name: string
    description: string
    script: string
    updatedAt: Date
  }[]
}

const DownloadButton: NextPage<{
  className?: string
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
  }, [blobParts])

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

const ExportUserDataButton: NextPage = () => {
  const [config, _] = useContext(ConfigContext)
  const treasuries = useLiveQuery(async () =>
    db
      .treasuries
      .toArray()
      .then((treasuries) => treasuries.map((treasury) => {
        return {
          name: treasury.name,
          description: treasury.description,
          script: Buffer.from(treasury.script).toString('base64'),
          updatedAt: treasury.updatedAt
        }
      }))
  )
  if (!treasuries) return null

  const userData: UserData = {
    isMainnet: config.isMainnet,
    version: '1',
    treasuries
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

const ImportUserData: NextPage = () => {
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

    if (version === '1') {
      const treasuries: Treasury[] = userData.treasuries.map((treasury) => {
        const script = Buffer.from(treasury.script, 'base64')
        const nativeScript = cardano.lib.NativeScript.from_bytes(script)
        const hash = cardano.hashScript(nativeScript).to_hex()
        return {
          hash,
          name: treasury.name,
          description: treasury.description,
          script,
          updatedAt: treasury.updatedAt
        }
      })

      db.treasuries.bulkAdd(treasuries)
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

export { ExportUserDataButton, ImportUserData }
