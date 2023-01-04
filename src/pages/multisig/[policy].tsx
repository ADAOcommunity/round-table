import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import type { Cardano } from '../../cardano/multiplatform-lib'
import { Loading, PartialLoading } from '../../components/status'
import { db } from '../../db'
import type { Policy, MultisigWalletParams } from '../../db'
import { useCallback, useContext, useMemo, useState } from 'react'
import type { FC } from 'react'
import { ConfigContext, isMainnet } from '../../cardano/config'
import { Hero, Layout, Panel, Modal } from '../../components/layout'
import { useLiveQuery } from 'dexie-react-hooks'
import { useUTxOSummaryQuery, isRegisteredOnChain, getAvailableReward } from '../../cardano/query-api'
import { ArrowDownTrayIcon, InformationCircleIcon } from '@heroicons/react/24/solid'
import { EditMultisigWallet, RemoveWallet, Summary } from '../../components/wallet'
import { NewTransaction } from '../../components/transaction'
import { NotificationContext } from '../../components/notification'
import { NativeScriptViewer } from '../../components/native-script'
import type { VerifyingData } from '../../components/native-script'
import { DownloadButton } from '../../components/user-data'
import type { NativeScript, SingleInputBuilder, SingleCertificateBuilder, SingleWithdrawalBuilder } from '@dcspark/cardano-multiplatform-lib-browser'
import { AddressableContent } from '../../components/address'
import { useLiveSlot } from '../../components/time'

const Spend: FC<{
  address: string
  rewardAddress: string
  cardano: Cardano
  policy: Policy
}> = ({ address, rewardAddress, cardano, policy }) => {
  const buildInputResult = useCallback((builder: SingleInputBuilder) => {
    if (typeof policy === 'string') return builder.payment_key()
    return builder.native_script(cardano.getPaymentNativeScriptFromPolicy(policy), cardano.lib.NativeScriptWitnessInfo.assume_signature_count())
  }, [cardano, policy])
  const buildCertResult = useCallback((builder: SingleCertificateBuilder) => {
    if (typeof policy === 'string') return builder.payment_key()
    return builder.native_script(cardano.getStakingNativeScriptFromPolicy(policy), cardano.lib.NativeScriptWitnessInfo.assume_signature_count())
  }, [cardano, policy])
  const buildWithdrawalResult = useCallback((builder: SingleWithdrawalBuilder) => {
    if (typeof policy === 'string') return builder.payment_key()
    return builder.native_script(cardano.getStakingNativeScriptFromPolicy(policy), cardano.lib.NativeScriptWitnessInfo.assume_signature_count())
  }, [cardano, policy])
  const { loading, error, data } = useUTxOSummaryQuery({
    variables: { addresses: [address], rewardAddress },
    fetchPolicy: 'network-only'
  })

  if (error) {
    console.error(error)
    return null
  }
  if (loading || !data) return (
    <PartialLoading />
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
      buildInputResult={buildInputResult}
      buildCertResult={buildCertResult}
      buildWithdrawalResult={buildWithdrawalResult}
      rewardAddress={rewardAddress}
      availableReward={availableReward}
      protocolParameters={protocolParameters}
      utxos={data.utxos}
      defaultChangeAddress={address} />
  )
}

const NativeScriptPanel: FC<{
  cardano: Cardano
  nativeScript: NativeScript
  filename: string
  title: string
  verifyingData: VerifyingData
}> = ({ cardano, nativeScript, filename, title, verifyingData }) => {
  return (
    <Panel>
      <div className='p-4 space-y-2'>
        <h2 className='font-semibold'>{title}</h2>
        <NativeScriptViewer
          cardano={cardano}
          className='p-2 border rounded space-y-2 text-sm'
          headerClassName='font-semibold'
          ulClassName='space-y-1'
          verifyingData={verifyingData}
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
  const currentSlot = useLiveSlot()
  const verifyingData: VerifyingData = useMemo(() => ({
    txExpirySlot: currentSlot,
    txStartSlot: currentSlot
  }), [currentSlot])
  const payment = useMemo(() => cardano.getPaymentNativeScriptFromPolicy(policy), [cardano, policy])
  const staking = useMemo(() => cardano.getStakingNativeScriptFromPolicy(policy), [cardano, policy])
  if (typeof policy === 'string') throw new Error('No NativeScript for policy in single address')

  return (
    <>
      <NativeScriptPanel
        cardano={cardano}
        nativeScript={payment}
        verifyingData={verifyingData}
        filename='payment.cbor'
        title='Payment Native Script' />
      <NativeScriptPanel
        cardano={cardano}
        nativeScript={staking}
        verifyingData={verifyingData}
        filename='staking.cbor'
        title='Staking Native Script' />
    </>
  )
}

const GetPolicy: NextPage = () => {
  const [config, _] = useContext(ConfigContext)
  const cardano = useCardanoMultiplatformLib()
  const router = useRouter()
  const policyContent = router.query.policy
  const result: { policy: Policy, address: string, rewardAddress: string } | undefined = useMemo(() => {
    if (!cardano || !policyContent) return
    if (typeof policyContent !== 'string') throw new Error('Cannot parse the policy')
    const { Address } = cardano.lib
    if (Address.is_valid_bech32(policyContent)) return {
      policy: policyContent,
      address: policyContent,
      rewardAddress: cardano.getPolicyRewardAddress(policyContent, isMainnet(config)).to_address().to_bech32()
    }
    const policy: Policy = JSON.parse(policyContent)
    const address = cardano.getPolicyAddress(policy, isMainnet(config)).to_bech32()
    const rewardAddress = cardano.getPolicyRewardAddress(policy, isMainnet(config)).to_address().to_bech32()
    return { policy, address, rewardAddress }
  }, [cardano, config, policyContent])
  const [tab, setTab] = useState<'summary' | 'spend' | 'edit' | 'remove' | 'native script'>('summary')
  const multisigWallet = useLiveQuery(async () => result && db.multisigWallets.get(result.address), [result])
  const walletParams: MultisigWalletParams | undefined = useMemo(() => {
    if (multisigWallet) return multisigWallet
    if (result) return {
      name: '',
      description: '',
      policy: result.policy
    }
  }, [multisigWallet, result])
  const { notify } = useContext(NotificationContext)
  const removeWallet = useCallback(() => {
    if (!multisigWallet) return
    db
      .multisigWallets
      .delete(multisigWallet.id)
      .then(() => router.push('/'))
      .catch((error) => {
        notify('error', 'Failed to delete')
        console.error(error)
      })
  }, [notify, router, multisigWallet])

  return (
    <Layout>
      {(!cardano || !result) && <Modal><Loading /></Modal>}
      {cardano && result && <div className='space-y-2'>
        <Hero>
          <h1 className='text-lg font-semibold'>{multisigWallet?.name ?? 'Unknown Account'}</h1>
          <div className='text-sm'>
            <AddressableContent buttonClassName='text-white' content={result.address} scanType='address' />
          </div>
          <div className='text-sm'>
            {multisigWallet && multisigWallet.description.length > 0 && <div>{multisigWallet.description}</div>}
          </div>
          <div className='flex'>
            <nav className='text-sm rounded border-white border divide-x overflow-hidden'>
              <button
                onClick={() => setTab('summary')}
                disabled={tab === 'summary'}
                className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
                Summary
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
              {multisigWallet && <button
                onClick={() => setTab('remove')}
                disabled={tab === 'remove'}
                className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
                Remove
              </button>}
            </nav>
          </div>
          {tab === 'edit' && <div className='flex items-center space-x-1'>
            <InformationCircleIcon className='w-4' />
            <span>You can create a new account by editing the policy. The assets in the original one will remain untouched.</span>
          </div>}
        </Hero>
        {tab === 'summary' && <Summary addresses={[result.address]} rewardAddress={result.rewardAddress} />}
        {tab === 'spend' && <Spend cardano={cardano} policy={result.policy} address={result.address} rewardAddress={result.rewardAddress} />}
        {tab === 'edit' && walletParams && <EditMultisigWallet cardano={cardano} params={walletParams} />}
        {tab === 'remove' && multisigWallet && <RemoveWallet walletName={multisigWallet.name} remove={removeWallet} />}
        {tab === 'native script' && typeof result.policy !== 'string' && <ShowNativeScript cardano={cardano} policy={result.policy} />}
      </div>}
    </Layout>
  )
}

export default GetPolicy
