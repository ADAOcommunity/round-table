import type { NextPage } from 'next'
import Link from 'next/link'

const Layout: NextPage = ({ children }) => {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-100 to-blue-100 overflow-y-scroll'>
      <header className='bg-white border-b border-gray-100 mb-2 shadow'>
        <div className='max-w-7xl mx-auto'>
          <nav className='flex flex-row-reverse divide-x divide-x-reverse font-medium '>
            <div className='p-4'>
              <Link href='/scripts/new'>
                <a className='text-base text-gray-500 hover:text-gray-900'>New Script</a>
              </Link>
            </div>
            <div className='p-4'>
              <Link href='/config'>
                <a className='text-base text-gray-500 hover:text-gray-900'>Config</a>
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
