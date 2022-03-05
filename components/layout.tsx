import type { NextPage } from 'next'
import Link from 'next/link'
import { CogIcon } from '@heroicons/react/solid'
import { useContext } from 'react'
import { ConfigContext } from '../cardano/config'

const Layout: NextPage = ({ children }) => {
  const [config, _] = useContext(ConfigContext)

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-100 to-blue-100'>
      <header className='bg-white border-b border-gray-100 mb-2 shadow'>
        <div className='flex max-w-7xl mx-auto'>
          <div className='flex grow items-center'>
            <div>
              {config.isMainnet && <span className='text-green-600'>MAINNET</span>}
              {!config.isMainnet && <span className='text-red-600'>TESTNET</span>}
            </div>
          </div>
          <nav className='flex divide-x font-medium items-center'>
            <div className='p-4'>
              <Link href='/scripts/new'>
                <a className='text-base text-gray-500 hover:text-gray-900'>New Script</a>
              </Link>
            </div>
            <div className='p-4'>
              <Link href='/config'>
                <a className='flex text-base text-gray-500 hover:text-gray-900 space-x-1'>
                  <CogIcon className='h-5 w-5' />
                </a>
              </Link>
            </div>
          </nav>
        </div>
      </header>
      <div>
        <div className='max-w-7xl mx-auto'>
          {children}
        </div>
      </div>
    </div>
  )
}

export default Layout
