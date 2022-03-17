import { useLiveQuery } from 'dexie-react-hooks'
import { NextPage } from 'next'
import { Layout } from '../../components/layout'
import { db } from '../../db'
import type { Treasury } from '../../db'
import { Cardano, encodeCardanoData, getResult } from '../../cardano/serialization-lib'
import { useCardanoSerializationLib } from '../../cardano/serialization-lib'
import { Loading } from '../../components/status'
import { useContext } from 'react'
import { ConfigContext } from '../../cardano/config'
import Link from 'next/link'

const TreasuryListing: NextPage<{
  cardano: Cardano
  treasury: Treasury
}> = ({ cardano, treasury }) => {
  const { address, title, description } = treasury
  const { NativeScript } = cardano.lib
  const [config, _] = useContext(ConfigContext)
  const result = getResult(() => NativeScript.from_bytes(treasury.script))

  if (!result.isOk) return <li>Broken NativeScript CBOR</li>;

  const script = result.data

  if (address !== cardano.getScriptAddress(script, config.isMainnet).to_bech32()) {
    return <li>Script addresses mismatch</li>
  }

  const base64CBOR = encodeCardanoData(treasury.script, 'base64')

  return (
    <li
      className='p-4 bg-white rounded-md'
      key={address}>
      {title && <h2 className='font-bold text-lg'>{title}</h2>}
      <p className='font-mono break-all'>{address}</p>
      <p className='space-x-1'>
        <span>Required Signers:</span>
        <span>{cardano.getRequiredSignatures(script)}&nbsp;/&nbsp;{script.get_required_signers().len()}</span>
      </p>
      {description && <p>{description}</p>}
      <nav className='flex mt-4 space-x-2'>
        <Link href={`/treasuries/${encodeURIComponent(base64CBOR)}`}>
          <a className='p-2 bg-green-100 text-green-500 rounded-md'>Create Transaction</a>
        </Link>
        <button
          onClick={() => db.treasuries.delete(address)}
          className='p-2 bg-red-100 text-red-500 rounded-md'>
          Delete
        </button>
      </nav>
    </li>
  )
}

const Treasuries: NextPage = () => {
  const treasuries = useLiveQuery(async () => db.treasuries.toArray())
  const cardano = useCardanoSerializationLib()

  if (!cardano) return <Loading />;

  return (
    <Layout>
      <h1 className='my-8 font-bold text-2xl text-center'>My Treasuries</h1>
      <ul className='space-y-2'>
        {treasuries && treasuries.map((treasury) =>
          <TreasuryListing key={treasury.address} cardano={cardano} treasury={treasury} />
        )}
      </ul>
    </Layout>
  )
}

export default Treasuries
