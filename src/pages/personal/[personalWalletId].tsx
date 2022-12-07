import { useLiveQuery } from 'dexie-react-hooks'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useState } from 'react'
import type { FC } from 'react'
import { CopyButton, Hero, Layout, Modal, Panel, Portal } from '../../components/layout'
import { Loading } from '../../components/status'
import { db } from '../../db'
import type { PersonalWallet } from '../../db'
import { useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import type { Cardano } from '../../cardano/multiplatform-lib'
import { ConfigContext, isMainnet } from '../../cardano/config'
import { DocumentDuplicateIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import { NotificationContext } from '../../components/notification'
import { RemoveWallet, Summary } from '../../components/wallet'
import { getAvailableReward, isRegisteredOnChain, useUTxOSummaryQuery } from '../../cardano/query-api'
import { NewTransaction } from '../../components/transaction'
import { formatDerivationPath } from '../../cardano/utils'

const DerivationPath: FC<{
  keyHash?: Uint8Array
}> = ({ keyHash }) => {
  const keyHashIndex = useLiveQuery(async () => keyHash && db.keyHashIndices.get(keyHash), [keyHash])
  const derivationPath = useMemo(() => keyHashIndex?.derivationPath, [keyHashIndex])

  if (!derivationPath) return null

  return (
    <>{formatDerivationPath(derivationPath)}</>
  )
}

const AddressTable: FC<{
  addresses: string[]
  addressName: string
}> = ({ addresses, addressName }) => {
  const cardano = useCardanoMultiplatformLib()

  return (
    <table className='table-auto w-full text-left'>
      <thead className='bg-gray-100'>
        <tr>
          <th className='p-4'>{addressName}</th>
          <th className='p-4'>Payment Derivation Path</th>
          <th className='p-4'>Staking Derivation Path</th>
        </tr>
      </thead>
      <tbody className='divide-y'>
        {addresses.map((address, index) => <tr key={index}>
          <td className='px-4 py-2 items-center'>
            <span>{address}</span>
            <CopyButton className='p-2 text-sky-700' getContent={() => address} ms={500}>
              <DocumentDuplicateIcon className='w-4' />
            </CopyButton>
          </td>
          <td className='px-4 py-2'><DerivationPath keyHash={cardano?.parseAddress(address).payment_cred()?.to_keyhash()?.to_bytes()} /></td>
          <td className='px-4 py-2'><DerivationPath keyHash={cardano?.parseAddress(address).staking_cred()?.to_keyhash()?.to_bytes()} /></td>
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
  const accountIndex = 0
  const account = useMemo(() => wallet.multisigAccounts[accountIndex], [wallet.multisigAccounts, accountIndex])
  const addresses = useMemo(() => cardano?.getAddressesFromMultisigAccount(account, isMainnet(config)), [cardano, account, config])

  if (!cardano || !addresses) return (
    <Modal><Loading /></Modal>
  )

  const add = () => {
    cardano.generateMultisigAddress(wallet, accountIndex)
    db.personalWallets.put(wallet)
  }

  return (
    <Panel>
      <AddressTable addresses={addresses} addressName='Address for multisig' />
      <footer className='flex justify-end p-4 bg-gray-100'>
        <button onClick={add} className='flex space-x-1 px-4 py-2 bg-sky-700 text-white rounded'>
          Add Address
        </button>
      </footer>
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
  }, [wallet])

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

const Spend: FC<{
  addresses: string[]
  rewardAddress: string
  cardano: Cardano
}> = ({ addresses, rewardAddress, cardano }) => {
  const { loading, error, data } = useUTxOSummaryQuery({
    variables: { addresses, rewardAddress },
    fetchPolicy: 'network-only'
  })
  const defaultChangeAddress = useMemo(() => {
    const address = addresses[0]
    if (!address) throw new Error('No address is found for change')
    return address
  }, [addresses])

  if (error) {
    console.error(error)
    return null
  }
  if (loading || !data) return (
    <Modal><Loading /></Modal>
  )

  const protocolParameters = data.cardano.currentEpoch.protocolParams
  if (!protocolParameters) throw new Error('No protocol parameter')
  const { stakeRegistrations_aggregate, stakeDeregistrations_aggregate, delegations } = data
  const isRegistered = isRegisteredOnChain(stakeRegistrations_aggregate, stakeDeregistrations_aggregate)
  const currentStakePool = isRegistered ? delegations[0]?.stakePool : undefined
  const availableReward = getAvailableReward(data.rewards_aggregate, data.withdrawals_aggregate)

  return (
    <NewTransaction
      isRegistered={isRegistered}
      currentDelegation={currentStakePool}
      cardano={cardano}
      buildInputResult={(builder) => builder.payment_key()}
      buildCertResult={(builder) => builder.payment_key()}
      buildWithdrawalResult={(builder) => builder.payment_key()}
      rewardAddress={rewardAddress}
      availableReward={availableReward}
      protocolParameters={protocolParameters}
      utxos={data.utxos}
      defaultChangeAddress={defaultChangeAddress} />
  )
}

const Personal: FC<{
  wallet: PersonalWallet
  className?: string
}> = ({ wallet, className }) => {
  const cardano = useCardanoMultiplatformLib()
  const [config, _] = useContext(ConfigContext)
  const accountIndex = 0
  const account = useMemo(() => wallet.personalAccounts[accountIndex], [wallet.personalAccounts, accountIndex])
  const addresses = useMemo(() => cardano?.getAddressesFromPersonalAccount(account, isMainnet(config)), [cardano, account, config])
  const rewardAddress = useMemo(() => cardano?.readRewardAddressFromPublicKey(account.publicKey, isMainnet(config)).to_address().to_bech32(), [cardano, config, account])
  const [tab, setTab] = useState<'summary' | 'receive' | 'spend'>('summary')

  if (!addresses || !rewardAddress || !cardano) return (
    <Modal><Loading /></Modal>
  )

  const add = () => {
    cardano.generatePersonalAddress(wallet, accountIndex)
    db.personalWallets.put(wallet)
  }

  return (
    <div className={className}>
      <Portal id='personal-subtab'>
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
            onClick={() => setTab('spend')}
            disabled={tab === 'spend'}
            className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
            Spend
          </button>
        </nav>
      </Portal>
      {tab === 'summary' && <Summary addresses={addresses} rewardAddress={rewardAddress} />}
      {tab === 'receive' && <Panel>
        <AddressTable addressName='Receiving Address' addresses={addresses} />
        <footer className='flex justify-end p-4 bg-gray-100'>
          <button onClick={add} className='flex space-x-1 px-4 py-2 bg-sky-700 text-white rounded'>
            Add Address
          </button>
        </footer>
      </Panel>}
      {tab === 'spend' && <Spend addresses={addresses} rewardAddress={rewardAddress} cardano={cardano} />}
    </div>
  )
}

const ShowPersonalWallet: NextPage = () => {
  const router = useRouter()
  const personalWallet = useLiveQuery(async () => {
    const id = router.query.personalWalletId
    if (typeof id !== 'string') return
    return db.personalWallets.get(parseInt(id))
  }, [router.query.personalWalletId])
  const [tab, setTab] = useState<'personal' | 'multisig' | 'edit' | 'remove'>('personal')
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
              onClick={() => setTab('personal')}
              disabled={tab === 'personal'}
              className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
              Personal
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
        {tab === 'personal' && <div className='flex' id='personal-subtab'></div>}
      </Hero>
      {tab === 'personal' && <Personal wallet={personalWallet} className='space-y-2' />}
      {tab === 'multisig' && <>
        <div className='p-4 text-yellow-700 bg-yellow-100 rounded shadow flex items-center space-x-1'>
          <ExclamationTriangleIcon className='w-4' />
          <div>These addresses are only for multisig.</div>
          <strong className='font-semibold'>DO NOT USE THEM TO RECEIVE FUNDS.</strong>
        </div>
        <Multisig wallet={personalWallet} />
      </>}
      {tab === 'edit' && <Edit wallet={personalWallet} />}
      {tab === 'remove' && <RemoveWallet walletName={personalWallet.name} remove={removeWallet} />}
    </Layout>
  )
}

export default ShowPersonalWallet
