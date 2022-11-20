import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import type { Cardano } from '../../cardano/multiplatform-lib'
import { Loading } from '../../components/status'
import { db } from '../../db'
import type { Account, Policy } from '../../db'
import { useContext, useMemo, useState } from 'react'
import type { FC } from 'react'
import { ConfigContext } from '../../cardano/config'
import { CopyButton, Hero, Layout, Panel } from '../../components/layout'
import { useLiveQuery } from 'dexie-react-hooks'
import { getAssetName, getBalanceByPaymentAddresses, getPolicyId, useGetUTxOsToSpendQuery, usePaymentAddressesQuery } from '../../cardano/query-api'
import { ADAAmount, AssetAmount } from '../../components/currency'
import { DocumentDuplicateIcon } from '@heroicons/react/24/solid'
import { EditAccount } from '../../components/account'
import { NewTransaction } from '../../components/transaction'
import { Modal } from '../../components/modal'
import { NotificationContext } from '../../components/notification'

const Balance: FC<{
  addresses: string[]
}> = ({ addresses }) => {
  const { data } = usePaymentAddressesQuery({
    variables: { addresses },
    fetchPolicy: 'cache-first',
    pollInterval: 5000
  })

  const balance = useMemo(() => {
    const paymentAddresses = data?.paymentAddresses
    if (!paymentAddresses) return
    return getBalanceByPaymentAddresses(paymentAddresses)
  }, [data])

  if (!balance) return (
    <Modal>
      <Loading />
    </Modal>
  )

  return (
    <Panel className='p-4 space-y-2'>
      <h2 className='font-semibold'>Balance</h2>
      <ul className='divide-y rounded border'>
        <li className='p-2'><ADAAmount lovelace={balance.lovelace} /></li>
        {Array.from(balance.assets).map(([id, quantity]) => {
          const symbol = Buffer.from(getAssetName(id), 'hex').toString('ascii')
          return (
            <li key={id} className='p-2'>
              <AssetAmount
                quantity={quantity}
                decimals={0}
                symbol={symbol} />
              <div className='space-x-1'>
                <span>Policy ID:</span>
                <span>{getPolicyId(id)}</span>
              </div>
            </li>
          )
        }
        )}
      </ul>
    </Panel>
  )
}

const Spend: FC<{
  address: string
  cardano: Cardano
  policy: Policy
}> = ({ address, cardano, policy }) => {
  const minLovelace = BigInt(5e6)
  const { loading, error, data } = useGetUTxOsToSpendQuery({
    variables: { addresses: [address] },
    fetchPolicy: 'network-only'
  })

  if (error) {
    console.error(error)
    return null
  }
  if (loading || !data) return (
    <Modal><Loading /></Modal>
  )

  const protocolParameters = data.cardano.currentEpoch.protocolParams
  if (!protocolParameters) throw new Error('No protocol parameter')

  return (
    <NewTransaction
      cardano={cardano}
      policy={policy}
      protocolParameters={protocolParameters}
      utxos={data.utxos}
      minLovelace={minLovelace}
      defaultChangeAddress={address} />
  )
}

const Delete: FC<{
  account: Account
}> = ({ account }) => {
  const [name, setName] = useState('')
  const router = useRouter()
  const { notify } = useContext(NotificationContext)

  const deleteHandler = () => {
    db
      .accounts
      .delete(account.id)
      .then(() => router.push('/'))
      .catch((error) => {
        notify('error', 'Failed to delete')
        console.error(error)
      })
  }

  return (
    <Panel>
      <div className='p-4 space-y-2'>
        <h2 className='font-semibold'>Delete Account</h2>
        <p>By deleting the account you will just remove the record in your browser. Others might still have it and the assets in it remain untouched. Type the account name below to proceed.</p>
        <input
          className='p-2 border rounded'
          type='text'
          placeholder='Type account name'
          value={name}
          onChange={(e) => setName(e.target.value)} />
      </div>
      <footer className='flex justify-end p-4 bg-gray-100'>
        <button
          className='px-4 py-2 bg-red-700 text-white rounded disabled:border disabled:text-gray-400 disabled:bg-gray-100'
          disabled={account.name !== name}
          onClick={deleteHandler}>
          DELETE
        </button>
      </footer>
    </Panel>
  )
}

const GetPolicy: NextPage = () => {
  const [config, _] = useContext(ConfigContext)
  const cardano = useCardanoMultiplatformLib()
  const router = useRouter()
  const policyContent = router.query.policy
  const result: { policy: Policy, address: string } | undefined = useMemo(() => {
    if (!cardano || !policyContent) return
    if (typeof policyContent !== 'string') throw new Error('Cannot parse the policy')
    const { Address } = cardano.lib
    if (Address.is_valid_bech32(policyContent)) return { policy: policyContent, address: policyContent }
    const policy: Policy = JSON.parse(policyContent)
    const address = cardano.getPolicyAddress(policy, config.isMainnet).to_bech32()
    return { policy, address }
  }, [cardano, config, policyContent])
  const [tab, setTab] = useState<'balance' | 'spend' | 'edit' | 'delete'>('balance')
  const account = useLiveQuery(async () => result && db.accounts.get(result.address), [result])

  return (
    <Layout>
      {(!cardano || !result) && <Modal><Loading /></Modal>}
      {cardano && result && <div className='space-y-2'>
        <Hero>
          <h1 className='text-lg font-semibold'>{account?.name ?? 'Unknown Account'}</h1>
          <div>
            <div className='flex items-center'>
              <span>{result.address}</span>
              <CopyButton className='p-2 text-sm text-white' getContent={() => result.address} ms={500}>
                <DocumentDuplicateIcon className='w-4' />
              </CopyButton>
            </div>
            {account && account.description.length > 0 && <div>{account.description}</div>}
          </div>
          <div className='flex'>
            <nav className='text-sm rounded border-white border divide-x overflow-hidden'>
              <button
                onClick={() => setTab('balance')}
                disabled={tab === 'balance'}
                className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
                Balance
              </button>
              <button
                onClick={() => setTab('spend')}
                disabled={tab === 'spend'}
                className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
                Spend
              </button>
              <button
                onClick={() => setTab('edit')}
                disabled={tab === 'edit'}
                className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
                Edit
              </button>
              {account && <button
                onClick={() => setTab('delete')}
                disabled={tab === 'delete'}
                className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
                Delete
              </button>}
            </nav>
          </div>
          {tab === 'edit' && <div>NOTE: You can create a new account by editing the policy.</div>}
        </Hero>
        {tab === 'balance' && <Balance addresses={[result.address]} />}
        {tab === 'spend' && <Spend cardano={cardano} policy={result.policy} address={result.address} />}
        {tab === 'edit' && <EditAccount cardano={cardano} account={account} />}
        {tab === 'delete' && account && <Delete account={account} />}
      </div>}
    </Layout>
  )
}

export default GetPolicy
