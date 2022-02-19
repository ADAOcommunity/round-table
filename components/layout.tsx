import type { NextPage } from 'next'
import Link from 'next/link'
import { NetworkSwitch } from './network-switch'

const Layout: NextPage = ({ children }) => {
  return (
    <div className='absolute w-full h-full bg-gradient-to-br from-slate-100 to-blue-100'>
      <header className='bg-white border-b border-gray-100 mb-2 shadow'>
        <div className='max-w-7xl mx-auto'>
          <nav className='flex flex-row-reverse divide-x divide-x-reverse'>
            <div className='p-4'>
              <Link href='/scripts/new'>
                <a className='text-base font-medium text-gray-500 hover:text-gray-900'>New Script</a>
              </Link>
            </div>
            <div className='p-4'>
              <NetworkSwitch />
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
