import { useLiveQuery } from 'dexie-react-hooks'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useState } from 'react'
import type { FC } from 'react'
import { CopyButton, Hero, Layout, Modal, Panel } from '../../components/layout'
import { Loading } from '../../components/status'
import { db } from '../../db'
import type { PersonalWallet } from '../../db'
import { useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import type { AddressWithPaths } from '../../cardano/multiplatform-lib'
import { ConfigContext } from '../../cardano/config'
import { DocumentDuplicateIcon } from '@heroicons/react/24/solid'
import { NotificationContext } from '../../components/notification'
import { RemoveWallet } from '../../components/wallet'

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

const Edit: FC<{
  wallet: PersonalWallet
}> = ({ wallet }) => {
  const [name, setName] = useState(wallet.name)
  const [description, setDescription] = useState(wallet.description)
  const { notify } = useContext(NotificationContext)

  useEffect(() => {
    setName(wallet.name)
    setDescription(wallet.description)
  }, [])

  const canSave = name.length > 0

  const save = () => {
    db
      .personalWallets
      .update(wallet.id, { name, description, updatedAt: new Date() })
      .catch(() => notify('error', 'Failed to save'))
  }

  return (
    <Panel>
      <div className='p-4 space-y-4'>
        <label className='block space-y-1'>
          <div className="after:content-['*'] after:text-red-500">Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='p-2 block border w-full rounded'
            placeholder='Write Name' />
        </label>
        <label className='block space-y-1'>
          <div>Description</div>
          <textarea
            className='p-2 block border w-full rounded'
            placeholder='Describe the wallet'
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}>
          </textarea>
        </label>
      </div>
      <footer className='flex justify-end p-4 bg-gray-100'>
        <button
          className='px-4 py-2 bg-sky-700 text-white rounded disabled:border disabled:text-gray-400 disabled:bg-gray-100'
          disabled={!canSave}
          onClick={save}>
          Save
        </button>
      </footer>
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
  const [tab, setTab] = useState<'summary' | 'receive' | 'spend' | 'multisig' | 'edit' | 'remove'>('summary')
  const { notify } = useContext(NotificationContext)

  if (!personalWallet) return (
    <Modal><Loading /></Modal>
  )

  const removeWallet = () => {
    db
      .personalWallets
      .delete(personalWallet.id)
      .then(() => router.push('/'))
      .catch((error) => {
        notify('error', 'Failed to delete')
        console.error(error)
      })
  }

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
            <button
              onClick={() => setTab('edit')}
              disabled={tab === 'edit'}
              className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
              Edit
            </button>
            <button
              onClick={() => setTab('remove')}
              disabled={tab === 'remove'}
              className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
              Remove
            </button>
          </nav>
        </div>
        {tab === 'multisig' && <div>These addresses are only for multisig. DO NOT USE THEM TO RECEIVE FUNDS.</div>}
      </Hero>
      {tab === 'summary' && <Summary />}
      {tab === 'receive' && <Receive wallet={personalWallet} />}
      {tab === 'multisig' && <Multisig wallet={personalWallet} />}
      {tab === 'edit' && <Edit wallet={personalWallet} />}
      {tab === 'remove' && <RemoveWallet walletName={personalWallet.name} remove={removeWallet} />}
    </Layout>
  )
}

export default ShowPersonalWallet
