import type { NextPage } from 'next'
import { useCardanoMultiplatformLib } from '../cardano/multiplatform-lib'
import { Hero, Layout, Modal } from '../components/layout'
import { Loading } from '../components/status'
import { EditMultisigWallet } from '../components/wallet'
import { useState } from 'react'
import type { FC } from 'react'
import type { MultisigWalletParams } from '../db'

const NewMultisigWallet: FC = () => {
  const cardano = useCardanoMultiplatformLib()
  const [params, setParams] = useState<MultisigWalletParams>({
    name: '',
    description: '',
    policy: { type: 'All', policies: [] }
  })

  if (!cardano) return (
    <Modal><Loading /></Modal>
  )

  return (
    <EditMultisigWallet cardano={cardano} params={params} setParams={setParams} />
  )
}

const CreateWallet: NextPage = () => {
  const [tab, setTab] = useState<'multisig' | 'hd'>('multisig')

  return (
    <Layout>
      <Hero>
        <h1 className='font-semibold text-lg'>New Wallet</h1>
        <p>Start to create an account protected by Multi-Sig native scripts from here by adding signer addresses or by setting timelocks. Only receiving addresses from one of our supported wallets should be used. Check the homepage for further information.</p>
        <div className='flex'>
          <nav className='text-sm rounded border-white border divide-x overflow-hidden'>
            <button
              onClick={() => setTab('multisig')}
              disabled={tab === 'multisig'}
              className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
              Multisig
            </button>
            <button
              onClick={() => setTab('hd')}
              disabled={tab === 'hd'}
              className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
              HD Wallet
            </button>
          </nav>
        </div>
      </Hero>
      {tab === 'multisig' && <NewMultisigWallet />}
    </Layout>
  )
}

export default CreateWallet
