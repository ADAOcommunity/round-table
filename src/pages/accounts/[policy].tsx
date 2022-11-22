import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import type { Cardano } from '../../cardano/multiplatform-lib'
import { Loading } from '../../components/status'
import { db } from '../../db'
import type { Account, AccountParams, Policy } from '../../db'
import { useContext, useEffect, useMemo, useState } from 'react'
import type { FC } from 'react'
import { ConfigContext } from '../../cardano/config'
import { CopyButton, Hero, Layout, Panel } from '../../components/layout'
import { useLiveQuery } from 'dexie-react-hooks'
import { getAssetName, getBalanceByPaymentAddresses, getPolicyId, useGetUTxOsToSpendQuery, usePaymentAddressesQuery } from '../../cardano/query-api'
import { ADAAmount, AssetAmount } from '../../components/currency'
import { DocumentDuplicateIcon, ArrowDownTrayIcon, InformationCircleIcon } from '@heroicons/react/24/solid'
import { CurrentAccountContext, EditAccount } from '../../components/account'
import { NewTransaction } from '../../components/transaction'
import { Modal } from '../../components/modal'
import { NotificationContext } from '../../components/notification'
import { NativeScriptViewer } from '../../components/native-script'
import { DownloadButton } from '../../components/user-data'
import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'

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

  useEffect(() => {
    let isMounted = true

    isMounted && setName('')

    return () => {
      isMounted = false
    }
  }, [account])

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
        <div>
          <p>Do you really want to delete <strong className='font-semibold'>{account.name}</strong>?</p>
          <p>By deleting the account you will just remove the record in your browser. Others might still have it and the assets in it remain untouched. Type the account name below to confirm.</p>
        </div>
        <input
          className='p-2 border rounded w-full'
          type='text'
          placeholder='Type the account name to confirm'
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

const NativeScriptPanel: FC<{
  cardano: Cardano
  nativeScript: NativeScript
  filename: string
  title: string
}> = ({ cardano, nativeScript, filename, title }) => {
  return (
    <Panel>
      <div className='p-4 space-y-2'>
        <h2 className='font-semibold'>{title}</h2>
        <NativeScriptViewer
          cardano={cardano}
          className='p-2 border rounded space-y-2'
          headerClassName='font-semibold'
          ulClassName='space-y-1'
          nativeScript={nativeScript} />
      </div>
      <footer className='flex justify-end p-4 bg-gray-100'>
        <DownloadButton
          blobParts={[nativeScript.to_bytes()]}
          options={{ type: 'application/cbor' }}
          download={filename}
          className='flex space-x-1 px-4 py-2 border text-sky-700 rounded'>
          <ArrowDownTrayIcon className='w-4' />
          <span>Download</span>
        </DownloadButton>
      </footer>
    </Panel>
  )
}

const ShowNativeScript: FC<{
  cardano: Cardano
  policy: Policy
}> = ({ cardano, policy }) => {
  if (typeof policy === 'string') throw new Error('No NativeScript for policy in single address')
  const payment = useMemo(() => cardano.getPaymentNativeScriptFromPolicy(policy), [cardano, policy])
  const staking = useMemo(() => cardano.getStakingNativeScriptFromPolicy(policy), [cardano, policy])

  return (
    <>
      <NativeScriptPanel
        cardano={cardano}
        nativeScript={payment}
        filename='payment.cbor'
        title='Payment Native Script' />
      <NativeScriptPanel
        cardano={cardano}
        nativeScript={staking}
        filename='staking.cbor'
        title='Staking Native Script' />
    </>
  )
}

const GetPolicy: NextPage = () => {
  const [config, _c] = useContext(ConfigContext)
  const [_a, setCurrentAccount] = useContext(CurrentAccountContext)
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
  const [tab, setTab] = useState<'balance' | 'spend' | 'edit' | 'delete' | 'native script'>('balance')
  const account = useLiveQuery(async () => result && db.accounts.get(result.address), [result])
  const [accountParams, setAccountParams] = useState<AccountParams | undefined>()

  useEffect(() => {
    let isMounted = true

    if (isMounted && account) {
      setAccountParams(account)
      setCurrentAccount(account)
    }

    return () => {
      isMounted = false
    }
  }, [account])

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
              <button
                onClick={() => setTab('native script')}
                disabled={tab === 'native script'}
                className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
                Native Script
              </button>
              {account && <button
                onClick={() => setTab('delete')}
                disabled={tab === 'delete'}
                className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
                Delete
              </button>}
            </nav>
          </div>
          {tab === 'edit' && <div className='flex items-center space-x-1'>
            <InformationCircleIcon className='w-4' />
            <span>You can create a new account by editing the policy. The assets in the original one will remain untouched.</span>
          </div>}
        </Hero>
        {tab === 'balance' && <Balance addresses={[result.address]} />}
        {tab === 'spend' && <Spend cardano={cardano} policy={result.policy} address={result.address} />}
        {tab === 'edit' && accountParams && <EditAccount cardano={cardano} params={accountParams} setParams={setAccountParams} />}
        {tab === 'delete' && account && <Delete account={account} />}
        {tab === 'native script' && typeof result.policy !== 'string' && <ShowNativeScript cardano={cardano} policy={result.policy} />}
      </div>}
    </Layout>
  )
}

export default GetPolicy
