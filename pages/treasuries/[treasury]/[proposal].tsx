import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout, Panel } from '../../../components/layout'
import { getResult, useCardanoSerializationLib } from '../../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../../components/status'
import { TransactionViewer } from '../../../components/transaction'
import { useContext } from 'react'
import { ConfigContext } from '../../../cardano/config'
import { nanoid } from 'nanoid'

const GetProposal: NextPage = () => {
  const [config, _] = useContext(ConfigContext)
  const router = useRouter()
  const { treasury, proposal } = router.query
  const cardano = useCardanoSerializationLib()

  if (!cardano) return <Loading />;

  if (typeof treasury !== 'string') return <ErrorMessage>Invalid script</ErrorMessage>;
  const scriptResult = getResult(() => cardano.lib.NativeScript.from_bytes(Buffer.from(treasury, 'base64')))
  if (!scriptResult.isOk) return <ErrorMessage>Invalid script</ErrorMessage>;

  if (typeof proposal !== 'string') return <ErrorMessage>Invalid transaction body</ErrorMessage>;
  const txBodyResult = getResult(() => cardano.lib.TransactionBody.from_bytes(Buffer.from(proposal, 'base64')))
  if (!txBodyResult.isOk) return <ErrorMessage>Invalid transaction body</ErrorMessage>;

  const script = scriptResult.data
  const address = cardano.getScriptAddress(script, config.isMainnet)
  const requiredSigners = Array.from({ length: script.get_required_signers().len() }, (_, i) => {
    return script.get_required_signers().get(i)
  })

  return (
    <Layout>
      <div className='space-y-2'>
        <Panel title='Treasury Address'>
          <p className='p-4'>{address.to_bech32()}</p>
        </Panel>
        <TransactionViewer txBody={txBodyResult.data} />
        <Panel title='Policy'>
          <table className='table-fixed border-collapse w-full text-sm'>
            <thead className='border-b'>
              <tr className='divide-x'>
                <th className='px-4 py-1'>Signer</th>
                <th className='px-4 py-1'>Signature</th>
              </tr>
            </thead>
            <tbody className='divide-y font-mono'>
              {requiredSigners.map((keyHash) => {
                const hex = Buffer.from(keyHash.to_bytes()).toString('hex')
                return (
                  <tr key={nanoid()} className="divide-x">
                    <td className='px-4 py-1 text-gray-500'>{hex}</td>
                    <td className='px-4 py-1'></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <footer className='px-4 py-2 bg-gray-100'>Type: {cardano.formatRequiredSigners(script)}</footer>
        </Panel>
      </div>
    </Layout>
  )
}

export default GetProposal
