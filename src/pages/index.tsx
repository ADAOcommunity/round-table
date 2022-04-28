import type { NextPage } from 'next'
import Link from 'next/link'
import { Layout, Panel } from '../components/layout'
import { WalletInfo } from '../components/transaction'

const Home: NextPage = () => {
  return (
    <Layout>
      <div className='space-y-2'>
        <Panel className='p-4 space-y-2'>
          <h1 className='text-lg font-semibold'>Round Table</h1>
          <p>Round Table is ADAO Community’s open-source, multi-signature dApp on Cardano blockchain. It aims at making Multi-Sig easy and intuitive for everyone. The project is designed and developed with decentralization in mind. All the libraries and tools were chosen in favor of decentralization. There is no server to keep your data. Your data is your own. It runs on your browser just like any other light wallets. You could also run it on your own PC easily.</p>
          <p>Round Table supports Nami, Eternl/cc and Gero wallets to sign so far. Flint Experimental can be used as well. Start your Multi-Sig journey by creating treasuries with your friends or family, or by <Link href='/config'><a className='text-sky-700'>importing your data</a></Link>.</p>
          <ul className='flex flex-wrap space-x-2'>
            <WalletInfo className='flex border rounded p-2 space-x-2 items-center w-48 shadow' name='nami' src='/nami.svg'>Nami Wallet</WalletInfo>
            <WalletInfo className='flex border rounded p-2 space-x-2 items-center w-48 shadow' name='eternl' src='/eternl.png'>Eternl/cc Wallet</WalletInfo>
            <WalletInfo className='flex border rounded p-2 space-x-2 items-center w-48 shadow' name='gero' src='https://gerowallet.io/assets/img/logo2.ico'>Gero Wallet</WalletInfo>
          </ul>
          <p>We have an active and welcoming community. If you have any issues or questions, feel free to reach out to us via <a className='text-sky-700' target='_blank' rel='noreferrer' href='https://github.com/ADAOcommunity/round-table'>Github</a> or <a className='text-sky-700' target='_blank' rel='noreferrer' href='https://discord.gg/BGuhdBXQFU'>Discord</a>.</p>
        </Panel>
      </div>
    </Layout>
  )
}

export default Home
