import type { NextPage } from 'next'
import Image from 'next/image'
import { Layout, Panel } from '../components/layout'

const Home: NextPage = () => {
  return (
    <Layout>
      <div className='space-y-2'>
        <Panel className='p-4 space-y-2'>
          <h1 className='text-lg font-semibold'>Round Table</h1>
          <p>Round Table is ADAO Community’s open-source, multi-signature dApp. ADAO plans to publish a user guide and proper documentation to allow for easier contribution to our open-source repository, and ease Round Table’s adoption by Cardano community projects and organisations. ADAO has already developed working minimum viable product (MVP) and is performing tests and reviews both internally and in collaboration with partner organisations.</p>
          <p>You can load your data in config page.</p>
          <Image src='/logo.svg' width={200} height={260} alt='brand' />
        </Panel>
      </div>
    </Layout>
  )
}

export default Home
