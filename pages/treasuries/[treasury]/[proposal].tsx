import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout, Panel } from '../../../components/layout'
import { getResult, useCardanoSerializationLib } from '../../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../../components/status'
import { SignTxButton, TransactionViewer } from '../../../components/transaction'
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
  const txBody = txBodyResult.data

  const signHandle = (content: string) => {
    console.log(`signed: ${content}`)
    const bytes = Buffer.from(content, 'hex')
    const witnessSet = cardano.lib.TransactionWitnessSet.from_bytes(bytes)
    console.log(witnessSet.vkeys()?.len())
  }

  return (
    <Layout>
      <div className='space-y-2'>
        <Panel title='Treasury Address'>
          <p className='p-4'>{address.to_bech32()}</p>
        </Panel>
        <TransactionViewer txBody={txBody} />
        <Panel title={`Policy: ${cardano.formatRequiredSigners(script)}`}>
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
        </Panel>
        <Panel title='Signature'>
          <div className='p-4'>
            <textarea
              className='block w-full border rounded-md p-2'
              rows={4}
              placeholder="Signature">
            </textarea>
          </div>
          <footer className='flex flex-row-reverse px-4 py-2 bg-gray-100 space-x-2 space-x-reverse'>
            <SignTxButton
              txBody={txBody}
              partialSign={true}
              signHandle={signHandle}
              wallet={'ccvault'}
              className='p-2 border rounded-md bg-blue-300 disabled:bg-gray-400'>
              Sign with ccvault
            </SignTxButton>
            <SignTxButton
              txBody={txBody}
              partialSign={true}
              signHandle={signHandle}
              wallet={'nami'}
              className='p-2 border rounded-md bg-blue-300 disabled:bg-gray-400'>
              Sign with nami
            </SignTxButton>
            <button className='p-2 border rounded-md bg-blue-300 disabled:bg-gray-400'>
              Manual Sign
            </button>
          </footer>
        </Panel>
      </div>
    </Layout>
  )
}

export default GetProposal
