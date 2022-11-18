import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { getResult, useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import type { Cardano, Result } from '../../cardano/multiplatform-lib'
import { ErrorMessage, Loading } from '../../components/status'
import { db, Policy } from '../../db'
import { useContext, useMemo, useState } from 'react'
import type { FC } from 'react'
import { ConfigContext } from '../../cardano/config'
import { CopyButton, Hero, Layout, Panel } from '../../components/layout'
import { useLiveQuery } from 'dexie-react-hooks'
import { getAssetName, getBalanceByPaymentAddresses, getPolicyId, useGetUTxOsToSpendQuery, usePaymentAddressesQuery } from '../../cardano/query-api'
import { ADAAmount, AssetAmount } from '../../components/currency'
import { ArrowPathIcon, DocumentDuplicateIcon } from '@heroicons/react/24/solid'
import { EditAccount } from '../../components/account'
import { NewTransaction } from '../../components/transaction'

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

  if (!balance) return <ArrowPathIcon className='w-4 animate-spin transform rotate-180' />;

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

  if (loading) return null
  if (error) {
    console.error(error)
    return null
  }
  if (!data) return null

  const protocolParameters = data.cardano.currentEpoch.protocolParams
  if (!protocolParameters) return null

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

const GetPolicy: NextPage = () => {
  const [config, _] = useContext(ConfigContext)
  const cardano = useCardanoMultiplatformLib()
  const router = useRouter()
  const policyContent = router.query.policy
  const result: Result<{ policy: Policy, address: string } | undefined> = useMemo(() => getResult(() => {
    if (!cardano) return
    if (!policyContent) return
    if (typeof policyContent !== 'string') throw new Error('Cannot parse the policy')
    const { Address } = cardano.lib
    if (Address.is_valid_bech32(policyContent)) return { policy: policyContent, address: policyContent }
    const policy: Policy = JSON.parse(policyContent)
    const address = cardano.getPolicyAddress(policy, config.isMainnet).to_bech32()
    return { policy, address }
  }), [cardano, config, policyContent])
  const [tab, setTab] = useState<'balance' | 'spend' | 'edit'>('balance')
  const account = useLiveQuery(async () => {
    if (result.isOk && result.data) {
      const { address } = result.data
      return db.accounts.get(address)
    }
  }, [result])

  if (!result.isOk) {
    console.error(result.message)
    return <ErrorMessage>Invalid Policy</ErrorMessage>;
  }
  if (!cardano) return <Loading />;
  if (!result.data) return <Loading />;

  const { policy, address } = result.data

  return (
    <Layout>
      <Hero>
        <h1 className='text-lg font-semibold'>{account?.name ?? 'Unknown Account'}</h1>
        <div>
          <div className='flex items-center'>
            <span>{address}</span>
            <CopyButton className='p-2 text-sm text-white' getContent={() => address} ms={500}>
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
          </nav>
        </div>
      </Hero>
      {tab === 'balance' && <Balance addresses={[result.data.address]} />}
      {tab === 'spend' && <Spend cardano={cardano} policy={policy} address={address} />}
      {tab === 'edit' && <EditAccount cardano={cardano} account={account} />}
    </Layout>
  )
}

export default GetPolicy
