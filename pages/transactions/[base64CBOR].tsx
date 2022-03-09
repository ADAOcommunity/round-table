import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout, Panel } from '../../components/layout'
import { CardanoSet, toHex } from '../../cardano/serialization-lib'
import { getResult, mapCardanoSet, useCardanoSerializationLib } from '../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../components/status'
import { SignTxButton, TransactionBodyViewer } from '../../components/transaction'
import type { NativeScript, Vkeywitness } from '@emurgo/cardano-serialization-lib-browser'
import { nanoid } from 'nanoid'
import { useState } from 'react'

const GetTransaction: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query
  const cardano = useCardanoSerializationLib()
  const [signatureMap, setSignatureMap] = useState<Map<string, Vkeywitness>>(new Map())

  if (!cardano) return <Loading />;

  if (typeof base64CBOR !== 'string') return <ErrorMessage>Invalid Transaction CBOR</ErrorMessage>;
  const txResult = getResult(() => cardano.lib.Transaction.from_bytes(Buffer.from(base64CBOR, 'base64')))
  if (!txResult.isOk) return <ErrorMessage>Invalid transaction</ErrorMessage>;

  const transaction = txResult.data
  const txHash = cardano.lib.hash_transaction(transaction.body()).to_bytes()
  const witnessSet = transaction.witness_set()
  const nativeScriptSet: CardanoSet<NativeScript> | undefined = witnessSet.native_scripts()
  const signerRegistry = new Set<string>()
  nativeScriptSet && mapCardanoSet(nativeScriptSet, (script) => {
    mapCardanoSet(script.get_required_signers(), (signer) => signerRegistry.add(toHex(signer)))
  })

  const signHandle = (content: string) => {
    const result = getResult(() => {
      const bytes = Buffer.from(content, 'hex')
      return cardano.lib.TransactionWitnessSet.from_bytes(bytes)
    })
    if (!result.isOk) return
    const witnessSet = result.data
    const vkeyWitnessSet: CardanoSet<Vkeywitness> | undefined = witnessSet.vkeys()
    vkeyWitnessSet && mapCardanoSet(vkeyWitnessSet, (vkeyWitness) => {
      const vkey = vkeyWitness.vkey()
      const signature = vkeyWitness.signature()
      const publicKey = vkey.public_key()
      const keyHash = publicKey.hash()
      const isValid = publicKey.verify(txHash, signature)
      const hex = toHex(keyHash)
      if (isValid && signerRegistry.has(hex)) {
        const newMap = new Map(signatureMap)
        newMap.set(hex, vkeyWitness)
        setSignatureMap(newMap)
      }
    })
  }

  return (
    <Layout>
      <div className='space-y-2'>
        <TransactionBodyViewer txBody={transaction.body()} />
        {nativeScriptSet && mapCardanoSet(nativeScriptSet, (script, index) =>
          <Panel title='Native Script' key={index}>
            <table className='table-fixed border-collapse w-full text-sm'>
              <thead className='border-b'>
                <tr className='divide-x'>
                  <th className='px-4 py-1'>Signer</th>
                  <th className='px-4 py-1'>Signature</th>
                </tr>
              </thead>
              <tbody className='divide-y font-mono'>
                {mapCardanoSet(script.get_required_signers(), (keyHash) => {
                  const hex = toHex(keyHash)
                  const vkey = signatureMap.get(hex)
                  const signature = vkey && cardano.buildSingleSignatureHex(vkey)
                  return (
                    <tr key={nanoid()} className={'divide-x ' + (signature ? 'bg-green-100' : '')}>
                      <td className={'px-4 py-1 ' + (signature ? 'text-green-500' : 'text-gray-500')}>{hex}</td>
                      <td className='px-4 py-1 text-green-500 break-all'>{signature}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Panel>
        )}
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
