import type { NextPage } from 'next'
import { Layout, Panel } from '../components/layout'
import { ExportUserDataButton, ImportUserData } from '../components/utils'

const Home: NextPage = () => {
  return (
    <Layout>
      <div className='space-y-2'>
        <Panel className='p-4 space-y-2'>
          <h1 className='text-lg font-semibold'>Round Table</h1>
          <p>Round Table is ADAO Community’s open-source, multi-signature dApp. ADAO plans to publish a user guide and proper documentation to allow for easier contribution to our open-source repository, and ease Round Table’s adoption by Cardano community projects and organisations. ADAO has already developed working minimum viable product (MVP) and is performing tests and reviews both internally and in collaboration with partner organisations.</p>
        </Panel>
        <Panel className='p-4 space-y-2'>
          <div className='font-semibold'>User Data Export/Import</div>
          <p>User data has to be on the same network. For example, data exported from testnet cannot be imported to mainnet.</p>
          <p>Save my treasuries</p>
          <div className='flex'>
            <ExportUserDataButton />
          </div>
          <p className='mt-2'>Load my treasuries</p>
          <div className='flex'>
            <ImportUserData />
          </div>
        </Panel>
      </div>
    </Layout>
  )
}

export default Home
