import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout, Panel } from '../../components/layout'
import type { CardanoSet } from '../../cardano/serialization-lib'
import { getResult, mapCardanoSet, useCardanoSerializationLib } from '../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../components/status'
import { SignTxButton, TransactionBodyViewer } from '../../components/transaction'
import type { Ed25519KeyHash, NativeScript } from '@emurgo/cardano-serialization-lib-browser'
import { nanoid } from 'nanoid'

const GetTransaction: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query
  const cardano = useCardanoSerializationLib()

  if (!cardano) return <Loading />;

  if (typeof base64CBOR !== 'string') return <ErrorMessage>Invalid Transaction CBOR</ErrorMessage>;
  const txResult = getResult(() => cardano.lib.Transaction.from_bytes(Buffer.from(base64CBOR, 'base64')))
  if (!txResult.isOk) return <ErrorMessage>Invalid transaction</ErrorMessage>;

  const transaction = txResult.data
  const witnessSet = transaction.witness_set()
  const nativeScriptSet: CardanoSet<NativeScript> | undefined = witnessSet.native_scripts()

  const signHandle = (content: string) => {
    console.log(`signed: ${content}`)
    const bytes = Buffer.from(content, 'hex')
    const witnessSet = cardano.lib.TransactionWitnessSet.from_bytes(bytes)
    console.log(witnessSet.vkeys()?.len())
  }

  return (
    <Layout>
      <div className='space-y-2'>
        <TransactionBodyViewer txBody={transaction.body()} />
        {nativeScriptSet && mapCardanoSet(nativeScriptSet, (script, index) => {
          const requiredSignerSet: CardanoSet<Ed25519KeyHash> = script.get_required_signers()
          return (
            <Panel title='Native Script' key={index}>
              <table className='table-fixed border-collapse w-full text-sm'>
                <thead className='border-b'>
                  <tr className='divide-x'>
                    <th className='px-4 py-1'>Signer</th>
                    <th className='px-4 py-1'>Signature</th>
                  </tr>
                </thead>
                <tbody className='divide-y font-mono'>
                  {mapCardanoSet(requiredSignerSet, (keyHash) => {
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
          )
        })}
        <Panel title='Signature'>
          <div className='p-4'>
            <textarea
              className='block w-full border rounded-md p-2'
              rows={4}
              placeholder="Signature">
            </textarea>
          </div>
          <footer className='flex px-4 py-2 bg-gray-100 space-x-2'>
            <SignTxButton
              transaction={transaction}
              partialSign={true}
              signHandle={signHandle}
              wallet='ccvault'
              className='p-2 border rounded-md bg-blue-300'>
              Sign with ccvault
            </SignTxButton>
            <SignTxButton
              transaction={transaction}
              partialSign={true}
              signHandle={signHandle}
              wallet='nami'
              className='p-2 border rounded-md bg-blue-300'>
              Sign with nami
            </SignTxButton>
            <SignTxButton
              transaction={transaction}
              partialSign={true}
              signHandle={signHandle}
              wallet='gero'
              className='p-2 border rounded-md bg-blue-300'>
              Sign with gero
            </SignTxButton>
            <SignTxButton
              transaction={transaction}
              partialSign={true}
              signHandle={signHandle}
              wallet='flint'
              className='p-2 border rounded-md bg-blue-300'>
              Sign with flint
            </SignTxButton>
            <button className='p-2 border rounded-md bg-blue-300'>
              Manual Sign
            </button>
          </footer>
        </Panel>
      </div>
    </Layout>
  )
}

export default GetTransaction
