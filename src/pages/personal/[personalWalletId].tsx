import { useLiveQuery } from 'dexie-react-hooks'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useContext, useMemo, useState } from 'react'
import type { FC } from 'react'
import { CopyButton, Hero, Layout, Modal, Panel } from '../../components/layout'
import { Loading } from '../../components/status'
import { db } from '../../db'
import type { PersonalWallet } from '../../db'
import { useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import type { AddressWithPaths } from '../../cardano/multiplatform-lib'
import { ConfigContext } from '../../cardano/config'
import { DocumentDuplicateIcon } from '@heroicons/react/24/solid'

const AddressTable: FC<{
  addresses: AddressWithPaths[]
}> = ({ addresses }) => {
  return (
    <table className='table-auto w-full text-left'>
      <thead className='bg-gray-100'>
        <tr>
          <th className='p-4'>Address</th>
          <th className='p-4'>Payment Derivation Path</th>
          <th className='p-4'>Staking Derivation Path</th>
        </tr>
      </thead>
      <tbody className='divide-y'>
        {addresses.map(({ address, paymentPath, stakingPath }, index) => <tr key={index}>
          <td className='px-4 py-2 items-center'>
            <span>{address}</span>
            <CopyButton className='p-2 text-sky-700' getContent={() => address} ms={500}>
              <DocumentDuplicateIcon className='w-4' />
            </CopyButton>
          </td>
          <td className='px-4 py-2'>{paymentPath}</td>
          <td className='px-4 py-2'>{stakingPath}</td>
        </tr>)}
      </tbody>
    </table>
  )
}

const Multisig: FC<{
  wallet: PersonalWallet
}> = ({ wallet }) => {
  const cardano = useCardanoMultiplatformLib()
  const [config, _] = useContext(ConfigContext)
  const addresses = useMemo(() => cardano?.getAddressesFromMultisigAccount(wallet.multisigAccount, 0, config.isMainnet), [cardano, wallet.multisigAccount, config.isMainnet])

  return (
    <Panel>
      {addresses && <AddressTable addresses={addresses} />}
    </Panel>
  )
}

const Receive: FC<{
  wallet: PersonalWallet
}> = ({ wallet }) => {
  const cardano = useCardanoMultiplatformLib()
  const [config, _] = useContext(ConfigContext)
  const accounts = useMemo(() => {
    if (!cardano) return
    return wallet.personalAccounts.map((account, index) => cardano.getAddressesFromPersonalAccount(account, index, config.isMainnet))
  }, [cardano, wallet.personalAccounts, config.isMainnet])
  const addresses = accounts && accounts[0]

  return (
    <Panel>
      {addresses && <AddressTable addresses={addresses} />}
    </Panel>
  )
}

const Summary: FC = () => {
  return (
    <Panel>
      <div className='p-4'>
        WIP
      </div>
    </Panel>
  )
}

const ShowPersonalWallet: NextPage = () => {
  const router = useRouter()
  const personalWallet = useLiveQuery(async () => {
    const id = router.query.personalWalletId
    if (typeof id !== 'string') return
    return db.personalWallets.get(parseInt(id))
  }, [router.query.personalWalletId])
  const [tab, setTab] = useState<'summary' | 'receive' | 'spend' | 'multisig' | 'edit' | 'delete'>('summary')

  if (!personalWallet) return (
    <Modal><Loading /></Modal>
  )

  return (
    <Layout>
      <Hero>
        <h1 className='font-semibold text-lg'>{personalWallet.name}</h1>
        <div>{personalWallet.description}</div>
        <div className='flex'>
          <nav className='text-sm rounded border-white border divide-x overflow-hidden'>
            <button
              onClick={() => setTab('summary')}
              disabled={tab === 'summary'}
              className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
              Summary
            </button>
            <button
              onClick={() => setTab('receive')}
              disabled={tab === 'receive'}
              className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
              Receive
            </button>
            <button
              onClick={() => setTab('multisig')}
              disabled={tab === 'multisig'}
              className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
              Multisig
            </button>
          </nav>
        </div>
        {tab === 'multisig' && <div>These addresses are only for multisig. DO NOT USE THEM TO RECEIVE FUNDS.</div>}
      </Hero>
      {tab === 'summary' && <Summary />}
      {tab === 'receive' && <Receive wallet={personalWallet} />}
      {tab === 'multisig' && <Multisig wallet={personalWallet} />}
    </Layout>
  )
}

export default ShowPersonalWallet
