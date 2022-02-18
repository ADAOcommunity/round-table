import Link from 'next/link'
import { useState, ReactNode } from 'react'

type LayoutProps = {
  children?: ReactNode
  onNetworkSwitch?: (isMainnet: boolean) => void
}
export default function Layout({ children, onNetworkSwitch }: LayoutProps) {
  const [isMainnet, setMainnet] = useState(true)
  const networkSwitch = (
    <label className='flex h-full space-x-2 text-sm text-gray-500'>
      <span>Mainnet</span>
      <input
        type="checkbox"
        className='hidden appearance-none peer'
        checked={isMainnet}
        onChange={() => { setMainnet(!isMainnet); onNetworkSwitch && onNetworkSwitch(!isMainnet) }} />
      <div className='flex flex-row-reverse rounded-full bg-gray-500 w-10 p-0.5 h-full peer-checked:flex-row peer-checked:bg-green-500'>
        <div className='bg-white w-5 rounded-full'></div>
      </div>
      <span>Testnet</span>
    </label>
  )

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
              {networkSwitch}
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
