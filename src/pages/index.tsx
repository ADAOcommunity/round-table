import type { NextPage } from 'next'
import Link from 'next/link'
import { Layout, Panel } from '../components/layout'

const Home: NextPage = () => {
  return (
    <Layout>
      <div className='space-y-2'>
        <Panel className='p-4 space-y-2'>
          <h1 className='text-lg font-semibold'>Round Table</h1>
          <p>Round Table is ADAO Community’s open-source, multi-signature dApp on Cardano blockchain. It aims at making Multi-Sig easy and intuitive for everyone. The project is designed and developed with decentralization in mind. All the libraries and tools were chosen in favor of decentralization. There is no server to keep your data. Your data is your own. It runs on your browser just like any other light wallets. You could also run it on your own PC easily.</p>
          <p>Round Table supports Nami, Eternl/cc and Gero wallets to sign so far. Flint Experimental can be used as well. Start your Multi-Sig journey by creating treasuries with your friends or family, or by <Link href='/config'><a className='text-sky-700'>importing your data</a></Link>.</p>
          <p>We have a nice community. If you have any issue or question, feel free to reach out to us on <a className='text-sky-700' target='_blank' rel='noreferrer' href='https://github.com/ADAOcommunity/round-table'>Github</a> or <a className='text-sky-700' target='_blank' rel='noreferrer' href='https://discord.gg/SDnm4GzY'>Discord</a>.</p>
        </Panel>
      </div>
    </Layout>
  )
}

export default Home
