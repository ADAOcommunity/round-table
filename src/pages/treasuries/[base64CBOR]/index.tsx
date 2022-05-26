import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import type { NextPage } from 'next'
import type { FC } from 'react'
import { useRouter } from 'next/router'
import { getResult, useCardanoMultiplatformLib } from '../../../cardano/multiplatform-lib'
import type { Cardano } from '../../../cardano/multiplatform-lib'
import { Layout, Panel } from '../../../components/layout'
import { ErrorMessage, Loading } from '../../../components/status'
import { AddressViewer, NativeScriptInfoViewer } from '../../../components/transaction'
import Link from 'next/link'
import { useContext, useMemo } from 'react'
import { ConfigContext } from '../../../cardano/config'
import { getAssetName, getBalanceByPaymentAddresses, getPolicyId, usePaymentAddressesQuery } from '../../../cardano/query-api'
import { ADAAmount, AssetAmount } from '../../../components/currency'
import { getTreasuryPath } from '../../../route'
import { DownloadIcon, RefreshIcon } from '@heroicons/react/solid'
import { DownloadButton } from '../../../components/user-data'
import { NativeScriptViewer } from '../../../components/native-script'
import { DateContext } from '../../../components/time'
import { estimateSlotByDate } from '../../../cardano/utils'

const ShowBalance: FC<{
  cardano: Cardano
  script: NativeScript
  className?: string
}> = ({ cardano, script, className }) => {
  const [config, _] = useContext(ConfigContext)
  const address = cardano.getScriptAddress(script, config.isMainnet).to_bech32()
  const { data } = usePaymentAddressesQuery({
    variables: { addresses: [address] },
    fetchPolicy: 'cache-first',
    pollInterval: 5000
  })

  const balance = useMemo(() => {
    const paymentAddresses = data?.paymentAddresses
    if (!paymentAddresses) return
    return getBalanceByPaymentAddresses(paymentAddresses)
  }, [data])

  if (!balance) return <RefreshIcon className='w-4 animate-spin transform rotate-180' />;

  return (
    <ul className={className}>
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
      })}
    </ul>
  )
}

const ShowTreasury: FC<{
  cardano: Cardano
  script: NativeScript
}> = ({ cardano, script }) => {
  const [date, _t] = useContext(DateContext)
  const [config, _c] = useContext(ConfigContext)

  return (
    <Panel>
      <div className='p-4 space-y-2'>
        <NativeScriptInfoViewer cardano={cardano} className='space-y-1' script={script} />
        <div className='space-y-1'>
          <div className='font-semibold'>Treasury Address</div>
          <AddressViewer address={cardano.getScriptAddress(script, config.isMainnet)} />
        </div>
        <div className='space-y-1'>
          <div className='font-semibold'>Script Details</div>
          <NativeScriptViewer
            verifyingData={{ signatures: new Map(), currentSlot: estimateSlotByDate(date, config.isMainnet) }}
            className='p-2 border rounded space-y-2'
            headerClassName='font-semibold'
            ulClassName='space-y-1'
            nativeScript={script} />
        </div>
        <div>
          <div className='font-semibold'>Balance</div>
          <ShowBalance className='divide-y rounded border' cardano={cardano} script={script} />
        </div>
      </div>
      <footer className='flex justify-end p-4 bg-gray-100 space-x-2'>
        <DownloadButton
          blobParts={[script.to_bytes()]}
          options={{ type: 'application/cbor' }}
          download='native_script.cbor'
          className='flex space-x-1 px-4 py-2 border text-sky-700 rounded'>
          <DownloadIcon className='w-4' />
          <span>Download Script</span>
        </DownloadButton>
        <Link href={getTreasuryPath(script, 'edit')}>
          <a className='px-4 py-2 border text-sky-700 rounded'>Edit Info</a>
        </Link>
        <Link href={getTreasuryPath(script, 'new')}>
          <a className='px-4 py-2 border text-white bg-sky-700 rounded'>Create Transaction</a>
        </Link>
      </footer>
    </Panel>
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
      <ShowTreasury cardano={cardano} script={script} />
    </Layout>
  )
}

export default GetTreasury
