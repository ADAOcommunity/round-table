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
          <h1 className='text-lg font-semibold'>Round Table</h1>
          <p>Round Table is ADAO Community’s open-source, multi-signature dApp. ADAO plans to publish a user guide and proper documentation to allow for easier contribution to our open-source repository, and ease Round Table’s adoption by Cardano community projects and organisations. ADAO has already developed working minimum viable product (MVP) and is performing tests and reviews both internally and in collaboration with partner organisations.</p>
          <nav>
            <Link href='/config'>
              <a className='text-sky-700'>Import my data to start</a>
            </Link>
          </nav>
        </Panel>
      </div>
    </Layout>
  )
}

export default Home
