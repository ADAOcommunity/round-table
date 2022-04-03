import type { NextPage } from 'next'
import Link from 'next/link'
import { CogIcon, HomeIcon, PlusIcon } from '@heroicons/react/solid'
import { ChangeEventHandler, useContext } from 'react'
import { ConfigContext } from '../cardano/config'
import { NotificationCenter } from './notification'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, Treasury } from '../db'
import { encodeCardanoData } from '../cardano/serialization-lib'

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

const Panel: NextPage<{ title: string }> = ({ title, children }) => (
  <div className='bg-white rounded-md shadow overflow-hidden'>
    <header className='border-b'>
      <h2 className='p-2 font-bold bg-gray-100 text-lg text-center'>{title}</h2>
    </header>
    <div>{children}</div>
  </div>
)

const NavLink: NextPage<{
  className?: string
  href: string
  onPageClassName: string
}> = ({ children, className, href, onPageClassName }) => {
  const isOnPage = document.location.pathname === href
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
    <aside className='flex flex-col basis-20 bg-indigo-900 items-center text-white'>
      <Link href='/'>
        <a className='p-4 hover:bg-indigo-700'>
          <HomeIcon className='w-12' />
        </a>
      </Link>
      <NavLink
        href='/config'
        onPageClassName='bg-indigo-700'
        className='p-4 hover:bg-indigo-700'>
        <CogIcon className='w-12' />
      </NavLink>
    </aside>
  )
}

const TreasuryListing: NextPage<{
  treasury: Treasury
}> = ({ treasury }) => {
  const { title, script } = treasury
  const base64CBOR = encodeCardanoData(script, 'base64')
  return (
    <NavLink
      href={`/treasuries/${encodeURIComponent(base64CBOR)}`}
      onPageClassName='bg-blue-700 font-semibold'
      className='flex w-full p-4 items-center space-x-1 truncate hover:bg-blue-700'>
      {title}
    </NavLink>
  )
}

const SecondaryBar: NextPage = () => {
  const treasuries = useLiveQuery(async () => db.treasuries.toArray())

  return (
    <aside className='flex flex-col basis-60 bg-blue-900 items-center text-white overflow-y-scroll'>
      <div className='w-full bg-blue-800 font-semibold'>
        <NavLink
          href='/treasuries/new'
          onPageClassName='bg-blue-700'
          className='flex w-full p-4 items-center space-x-1 justify-center hover:bg-blue-700'>
          <PlusIcon className='w-4' />
          <span>New Treasury</span>
        </NavLink>
      </div>
      {treasuries && treasuries.map((treasury, index) => <TreasuryListing key={index} treasury={treasury} />)}
    </aside>
  )
}

const Layout: NextPage = ({ children }) => {
  const [config, _] = useContext(ConfigContext)

  return (
    <div className='flex h-screen'>
      <PrimaryBar />
      <SecondaryBar />
      <div className='grow'>
        {!config.isMainnet && <div className='p-1 bg-red-700 text-white text-center'>You are using testnet</div>}
        <div className='mx-auto flex flex-row-reverse'>
          <NotificationCenter className='fixed space-y-2 w-1/5' />
        </div>
        <div className='max-w-7xl mx-auto'>
          {children}
        </div>
      </div>
    </div>
  )
}

export { Layout, Panel, Toggle }
