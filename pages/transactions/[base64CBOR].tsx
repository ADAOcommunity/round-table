import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout, Panel } from '../../components/layout'
import { toHex, toIter } from '../../cardano/serialization-lib'
import { getResult, useCardanoSerializationLib } from '../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../components/status'
import { NativeScriptViewer, SignTxButton, SubmitTxButton, TransactionBodyViewer } from '../../components/transaction'
import type { Vkeywitness } from '@zqlsg/cardano-serialization-lib-browser'
import { useState } from 'react'
import { PencilAltIcon } from '@heroicons/react/solid'

const ManualSign: NextPage<{
  signHandle: (_: string) => void
}> = ({ children, signHandle }) => {
  const [signature, setSignature] = useState('')
  const isDisabled = !signature

  const manualSignHandle = () => {
    signHandle(signature)
    setSignature('')
  }

  return (
    <Panel title='Sign'>
      <textarea
        className='block w-full p-4 outline-none'
        rows={4}
        value={signature}
        onChange={(e) => setSignature(e.target.value)}
        placeholder="Signature">
      </textarea>
      <footer className='flex px-4 py-2 bg-gray-100 space-x-2'>
        {children}
        <button
          onClick={manualSignHandle}
          disabled={isDisabled}
          className='flex items-center space-x-1 p-2 border rounded-md bg-blue-100 text-blue-500 disabled:bg-gray-100 disabled:text-gray-500'>
          <PencilAltIcon className='h-6' />
          <span>Manual Sign</span>
        </button>
      </footer>
    </Panel>
  )
}

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
  const nativeScriptSet = witnessSet.native_scripts()
  const signerRegistry = new Set<string>()
  nativeScriptSet && Array.from(toIter(nativeScriptSet), (script) => {
    Array.from(toIter(script.get_required_signers()), (signer) => signerRegistry.add(toHex(signer)))
  })

  const signHandle = (signatures: string[] | string) => {
    const newMap = new Map(signatureMap)

    function getSignatures(): string[] {
      if (typeof signatures === 'string') return [signatures]
      return signatures
    }

    getSignatures().forEach((signature) => {
      const result = getResult(() => {
        const bytes = Buffer.from(signature, 'hex')
        return cardano.lib.TransactionWitnessSet.from_bytes(bytes)
      })

      if (!result.isOk) return

      const witnessSet = result.data
      const vkeyWitnessSet = witnessSet.vkeys()

      if (!vkeyWitnessSet) return

      Array.from(toIter(vkeyWitnessSet), (vkeyWitness) => {
        const vkey = vkeyWitness.vkey()
        const signature = vkeyWitness.signature()
        const publicKey = vkey.public_key()
        const keyHash = publicKey.hash()
        const isValid = publicKey.verify(txHash, signature)
        const hex = toHex(keyHash)
        if (isValid && signerRegistry.has(hex)) {
          newMap.set(hex, vkeyWitness)
        }
      })
    })

    setSignatureMap(newMap)
  }

  const signedTransaction = cardano.signTransaction(transaction, signatureMap.values())

  return (
    <Layout>
      <div className='space-y-2'>
        <TransactionBodyViewer cardano={cardano} txBody={transaction.body()} />
        {nativeScriptSet && Array.from(toIter(nativeScriptSet), (script, index) =>
          <NativeScriptViewer cardano={cardano} script={script} signatures={signatureMap} key={index} />
        )}
        <ManualSign signHandle={signHandle}>
          <SignTxButton
            transaction={transaction}
            partialSign={true}
            signHandle={signHandle}
            wallet='nami'
            className='flex items-center space-x-1 p-2 border rounded-md bg-blue-100 text-blue-500 disabled:bg-gray-100 disabled:text-gray-500' />
          <SignTxButton
            transaction={transaction}
            partialSign={true}
            signHandle={signHandle}
            wallet='gero'
            className='flex items-center space-x-1 p-2 border rounded-md bg-blue-100 text-blue-500 disabled:bg-gray-100 disabled:text-gray-500' />
        </ManualSign>
        <div className='text-center'>
          <SubmitTxButton
            className='py-3 px-4 font-bold text-lg bg-green-100 text-green-500 rounded-full shadow disabled:bg-gray-100 disabled:text-gray-500'
            transaction={signedTransaction}>
            Submit Transaction
          </SubmitTxButton>
        </div>
      </div>
    </Layout>
  )
}

export default GetTransaction
