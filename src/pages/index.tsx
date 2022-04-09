import type { NextPage } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Layout, Panel } from '../components/layout'

const Home: NextPage = () => {
  return (
    <Layout>
      <div className='space-y-2'>
        <Panel className='p-4 space-y-2'>
          <div className='flex justify-center'>
            <Image src='/logo.svg' width={200} height={260} alt='brand' />
          </div>
          <p>Round Table is ADAO Community’s open-source, multi-signature dApp on Cardano blockchain. It aims at making Multi-Sig easy, funny and comfortable. The project is designed and developed with decentralization in mind. All the libraries and tools were chosen in favor of decentralization. There is no server to keep your data. Your data is your own. It runs on your browser just like any other light wallets. You could also run it on your own PC easily.</p>
          <p>Start your Multi-Sig journey by creating treasuries with your friends or family, or by <Link href='/config'><a className='text-sky-700'>importing your data</a></Link>.</p>
        </Panel>
      </div>
    </Layout>
  )
}

export default Home
