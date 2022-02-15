import Link from 'next/link'

export default function Layout({ children }) {
  return (
    <>
      <Header />
      <div className='relative bg-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6'>
          {children}
        </div>
      </div>
    </>
  )
}

function Header() {
  return (
    <header className='relative bg-white mb-2'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6'>
        <div className='flex justify-between items-center border-b-2 border-gray-100 py-6 md:justify-start md:space-x-10'>
          <div className='flex justify-start lg:w-0 lg:flex-1'></div>
          <div className='-mr-2 -my-2 md:hidden'></div>
          <nav className='hidden md:flex space-x-10'>
            <Link href='/scripts/new'>
              <a className='text-base font-medium text-gray-500 hover:text-gray-900'>New Script</a>
            </Link>
          </nav>
          <div className='hidden md:flex items-center justify-end md:flex-1 lg:w-0'></div>
        </div>
      </div>
    </header>
  )
}
