import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { getResult, useCardanoMultiplatformLib } from '../../../cardano/multiplatform-lib'
import type { Cardano } from '../../../cardano/multiplatform-lib'
import { Layout, Panel } from '../../../components/layout'
import { ErrorMessage, Loading } from '../../../components/status'
import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { useContext } from 'react'
import { ConfigContext } from '../../../cardano/config'
import { useGetDelegationQuery, useGetStakePoolsQuery } from '../../../cardano/query-api'
import { AddressViewer, NativeScriptInfoViewer } from '../../../components/transaction'
import { StakePool } from '@cardano-graphql/client-ts'
import { ADAAmount } from '../../../components/currency'
import { getTransactionPath } from '../../../route'

const ShowStake: NextPage<{
  cardano: Cardano
  script: NativeScript
}> = ({ cardano, script }) => {
  const [config, _] = useContext(ConfigContext)
  const scriptHash = cardano.hashScript(script)
  const stakeCredential = cardano.lib.StakeCredential.from_scripthash(scriptHash)
  const networkInfo = config.isMainnet ? cardano.lib.NetworkInfo.mainnet() : cardano.lib.NetworkInfo.testnet()
  const rewardAddress = cardano.lib.RewardAddress.new(networkInfo.network_id(), stakeCredential)
  const address = cardano.getScriptAddress(script, config.isMainnet)
  const { data } = useGetDelegationQuery({
    variables: { address: address.to_bech32(), rewardAddress: rewardAddress.to_address().to_bech32() }
  })
  const poolId = data &&
    data.stakeRegistrations.length > data.stakeDeregistrations.length &&
    data.delegations &&
    data.delegations[0].stakePool.id
  const protocolParameters = data?.cardano.currentEpoch?.protocolParams
  const delegate = (id: string) => {
    if (protocolParameters) {
      const txBuilder = cardano.createTxBuilder(protocolParameters)
      const nativeScripts = cardano.lib.NativeScripts.new()
      nativeScripts.add(script)
      txBuilder.set_native_scripts(nativeScripts)
      const poolKeyHash = cardano.lib.Ed25519KeyHash.from_bech32(id)
      const stakeDelegation = cardano.lib.StakeDelegation.new(stakeCredential, poolKeyHash)
      const isRegistered = data.stakeRegistrations.length > data.stakeDeregistrations.length
      const certificates = cardano.lib.Certificates.new()
      if (!isRegistered) {
        const stakeRegistration = cardano.lib.StakeRegistration.new(stakeCredential)
        certificates.add(cardano.lib.Certificate.new_stake_registration(stakeRegistration))
      }
      certificates.add(cardano.lib.Certificate.new_stake_delegation(stakeDelegation))
      txBuilder.set_certs(certificates)
      cardano.chainCoinSelection(txBuilder, cardano.buildUTxOSet(data.utxos), address)
      const transaction = txBuilder.build_tx()
      const path = getTransactionPath(transaction)
      console.log(path)
    }
  }

  return (
    <Panel className='p-4 space-y-2'>
      <h2 className='text-lg font-semibold'>Staking</h2>
      <div className='space-y-1'>
        <div className='font-semibold'>Reward Address</div>
        <div><AddressViewer address={rewardAddress.to_address()} /></div>
      </div>
      <div className='space-y-1'>
        <div className='font-semibold'>Current Delegating Pool</div>
        <div>{poolId ? poolId : 'N/A'}</div>
      </div>
      <div className='space-y-1'>
        <div className='font-semibold'>Staking Pools</div>
        <StakePools delegate={delegate} />
      </div>
    </Panel>
  )
}

const StakePool: NextPage<{
  stakePool: StakePool
  delegate: (id: string) => void
}> = ({ delegate, stakePool }) => {
  const id = stakePool.id
  return (
    <li className='p-2 border rounded shadow'>
      <div className='truncate'>{id}</div>
      <div className='space-x-1'>
        <span className='font-semibold'>Margin:</span>
        <span>{stakePool.margin * 100}%</span>
      </div>
      <div className='space-x-1'>
        <span className='font-semibold'>Fixed Fees:</span>
        <ADAAmount lovelace={BigInt(stakePool.fixedCost)} />
      </div>
      <div className='space-x-1'>
        <span className='font-semibold'>Pledge:</span>
        <ADAAmount lovelace={BigInt(stakePool.pledge)} />
      </div>
      <div className='space-x-1'>
        <span className='font-semibold'>Blocks:</span>
        <span>{stakePool.blocks_aggregate.aggregate?.count}</span>
      </div>
      <nav className='flex justify-end'>
        <button
          onClick={() => delegate(id)}
          className='px-2 py-1 border rounded text-sm text-white bg-sky-700'>
          Delegate
        </button>
      </nav>
    </li>
  )
}

const StakePools: NextPage<{
  delegate: (id: string) => void
}> = ({ delegate }) => {
  const { data } = useGetStakePoolsQuery({
    variables: { limit: 30, offset: 0 }
  })
  const stakePools = data?.stakePools

  if (!stakePools) return null;

  return (
    <div>
      <ul className='grid gap-2 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
        {stakePools.map((stakePool) => <StakePool key={stakePool.id} delegate={delegate} stakePool={stakePool} />)}
      </ul>
    </div>
  )
}

const GetTreasury: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query
  const cardano = useCardanoMultiplatformLib()

  if (!cardano) return <Loading />;
  if (typeof base64CBOR !== 'string') return <ErrorMessage>Invalid URL</ErrorMessage>;
  const parseResult = getResult(() => cardano.lib.NativeScript.from_bytes(Buffer.from(base64CBOR, 'base64')))
  if (!parseResult.isOk) return <ErrorMessage>Invalid script</ErrorMessage>;
  const script = parseResult.data

  return (
    <Layout>
      <div className='space-y-2'>
        <Panel className='p-4'>
          <NativeScriptInfoViewer cardano={cardano} script={script} />
        </Panel>
        <ShowStake cardano={cardano} script={script} />
      </div>
    </Layout>
  )
}

export default GetTreasury
