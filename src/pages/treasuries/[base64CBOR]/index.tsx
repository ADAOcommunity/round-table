import type { NativeScript } from '@adaocommunity/cardano-serialization-lib-browser'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { encodeCardanoData, getResult, useCardanoSerializationLib } from '../../../cardano/serialization-lib'
import type { Cardano } from '../../../cardano/serialization-lib'
import { Layout, Panel } from '../../../components/layout'
import { ErrorMessage, Loading } from '../../../components/status'
import { NativeScriptInfoViewer, NativeScriptViewer } from '../../../components/transaction'
import Link from 'next/link'
import { useContext } from 'react'
import { ConfigContext } from '../../../cardano/config'
import { getAssetName, getBalance, getPolicyId, useAddressUTxOsQuery } from '../../../cardano/query-api'
import { ADAAmount, AssetAmount } from '../../../components/currency'

const ShowBalance: NextPage<{
  cardano: Cardano
  script: NativeScript
  className?: string
}> = ({ cardano, script, className }) => {
  const [config, _] = useContext(ConfigContext)
  const address = cardano.getScriptAddress(script, config.isMainnet).to_bech32()
  const utxos = useAddressUTxOsQuery(address, config)

  if (utxos.type !== 'ok') return <></>;

  const balance = getBalance(utxos.data)

  return (
    <div className={className}>
      <div className='font-semibold'>Balance</div>
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
                <span>PolicyID:</span>
                <span>{getPolicyId(id)}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const ShowTreasury: NextPage<{
  cardano: Cardano
  script: NativeScript
}> = ({ cardano, script }) => {
  const base64CBOR = encodeCardanoData(script, 'base64')

  return (
    <Panel>
      <div className='p-4 space-y-2'>
        <NativeScriptInfoViewer className='space-y-1' script={script} />
        <NativeScriptViewer className='space-y-2' cardano={cardano} script={script} />
        <ShowBalance cardano={cardano} script={script} />
      </div>
      <footer className='flex justify-end p-4 bg-gray-100'>
        <Link href={`/treasuries/${encodeURIComponent(base64CBOR)}/edit`}>
          <a className='px-4 py-2 border text-sky-700 rounded'>Edit Info</a>
        </Link>
      </footer>
    </Panel>
  )
}

const GetTreasury: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query
  const cardano = useCardanoSerializationLib()

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
