import type { NextPage } from 'next'
import Link from 'next/link'
import { CogIcon, HomeIcon, PlusIcon } from '@heroicons/react/solid'
import { ChangeEventHandler, useContext, useEffect, useState } from 'react'
import { ConfigContext } from '../cardano/config'
import { NotificationCenter } from './notification'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, Treasury } from '../db'
import { useRouter } from 'next/router'

const Toggle: NextPage<{
  isOn: boolean
  onChange: ChangeEventHandler<HTMLInputElement>
}> = ({ isOn, onChange }) => {
  return (
    <label className='cursor-pointer'>
      <input className='hidden peer' type='checkbox' checked={isOn} onChange={onChange} />
      <div className='flex flex-row-reverse border w-12 rounded-full border-gray-500 bg-gray-500 peer-checked:bg-green-500 peer-checked:border-green-500 peer-checked:flex-row'>
        <div className='h-6 w-6 rounded-full bg-white'></div>
      </div>
    </label>
  )
}

const Panel: NextPage<{className?: string}> = ({ children, className }) => {
  return (
    <div className={'border-t-4 border-sky-700 bg-white rounded shadow overflow-hidden ' + className}>
      {children}
    </div>
  )
}

const BackButton: NextPage<{
  className?: string
}> = ({ children, className }) => {
  const router = useRouter()
  return <button className={className} onClick={() => router.back()}>{children}</button>;
}

const NavLink: NextPage<{
  className?: string
  href: string
  onPageClassName: string
}> = ({ children, className, href, onPageClassName }) => {
  const [isOnPage, setIsOnPage] = useState(false)
  const parentPaths = href.split('/')

  useEffect(() => {
    let isMounted = true

    const currentPaths = document.location.pathname.split('/')
    const isOnPage = parentPaths.every((name, index) => name === currentPaths[index])

    if (isMounted) setIsOnPage(isOnPage)

    return () => {
      isMounted = false
    }
  })

  return (
    <Link href={href}>
      <a className={[className, isOnPage ? onPageClassName : ''].join(' ')}>
        {children}
      </a>
    </Link>
  )
}

const PrimaryBar: NextPage = () => {
  return (
    <aside className='flex flex-col w-20 bg-sky-900 items-center text-white'>
      <Link href='/'>
        <a className='p-4 hover:bg-sky-700'>
          <HomeIcon className='w-12' />
        </a>
      </Link>
      <NavLink
        href='/config'
        onPageClassName='bg-sky-700'
        className='p-4 hover:bg-sky-700'>
        <CogIcon className='w-12' />
      </NavLink>
    </aside>
  )
}

const TreasuryListing: NextPage<{
  treasury: Treasury
}> = ({ treasury }) => {
  const { name, script } = treasury
  return (
    <NavLink
      href={`/treasuries/${encodeURIComponent(script)}`}
      onPageClassName='bg-sky-700 font-semibold'
      className='block w-full p-4 truncate hover:bg-sky-700'>
      {name}
    </NavLink>
  )
}

const SecondaryBar: NextPage = () => {
  const treasuries = useLiveQuery(async () => db.treasuries.toArray())

  return (
    <aside className='flex flex-col w-60 bg-sky-800 items-center text-white overflow-y-scroll'>
      <div className='w-full bg-sky-900 font-semibold'>
        <NavLink
          href='/treasuries/new'
          onPageClassName='bg-sky-700'
          className='flex w-full p-4 items-center space-x-1 justify-center hover:bg-sky-700'>
          <PlusIcon className='w-4' />
          <span>New Treasury</span>
        </NavLink>
      </div>
      {treasuries && treasuries.map((treasury, index) => <TreasuryListing key={index} treasury={treasury} />)}
    </aside>
  )
}

const Hero: NextPage<{ className?: string }> = ({ className, children }) => {
  return <div className={'rounded p-4 bg-sky-700 text-white shadow space-y-4 ' + className}>{ children }</div>;
}

const Layout: NextPage = ({ children }) => {
  const [config, _] = useContext(ConfigContext)

  return (
    <div className='flex h-screen'>
      <PrimaryBar />
      <SecondaryBar />
      <div className='w-full bg-sky-100 overflow-y-scroll'>
        {!config.isMainnet && <div className='p-1 bg-red-900 text-white text-center'>You are using testnet</div>}
        <div className='flex flex-row-reverse'>
          <NotificationCenter className='fixed space-y-2 w-1/5' />
        </div>
        <div className='p-2 h-screen'>
          {children}
        </div>
      </div>
    </div>
  )
}

export { Layout, Panel, Toggle, Hero, BackButton }
