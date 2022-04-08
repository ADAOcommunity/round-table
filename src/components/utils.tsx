import { useLiveQuery } from 'dexie-react-hooks'
import { NextPage } from 'next'
import { ChangeEventHandler, MouseEventHandler, useState } from 'react'
import { db, Treasury } from '../db'

const DownloadDataButton: NextPage<{
  className?: string
  mime: string
  filename: string
  data: string
}> = ({ className, data, filename, children, mime }) => {
  const href = `data:${mime},` + encodeURIComponent(data)
  return (
    <a
      href={href}
      download={filename}
      className={className}>
      {children}
    </a>
  )
}

type UserData = {
  treasuries: Treasury[]
}

const ExportUserDataButton: NextPage = () => {
  const treasuries = useLiveQuery(async () => db.treasuries.toArray())

  if (!treasuries) return null

  const data = JSON.stringify({ treasuries })

  return (
    <DownloadDataButton
      className='p-2 rounded bg-sky-700 text-white'
      mime='application/json;charset=utf-8'
      filename='roundtable-backup.json'
      data={data}>
      Export User Data
    </DownloadDataButton>
  )
}

const ImportUserData: NextPage = () => {
  const [userData, setUserData] = useState<UserData | undefined>(undefined)

  const changeHandle: ChangeEventHandler<HTMLInputElement> = async (event) => {
    event.preventDefault()
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = (e.target?.result)
      if (typeof text !== 'string') {
        console.error('Invalid backup file')
        return
      }
      setUserData(JSON.parse(text))
    }
    const files = event.target.files
    if (files) {
      reader.readAsText(files[0])
    }
  }

  const clickHandle: MouseEventHandler<HTMLButtonElement> = () => {
    if (!userData) return;
    db.treasuries.bulkAdd(userData.treasuries)
  }

  return (
    <div className='rounded border border-sky-700 overflow-hidden'>
      <input
        type='file'
        onChange={changeHandle} />
      <button
        className='p-2 bg-sky-700 text-white'
        onClick={clickHandle}
        disabled={!userData}>
        Import User Data
      </button>
    </div>
  )
}

export { ExportUserDataButton, ImportUserData }
