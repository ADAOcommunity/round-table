import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout, Panel } from '../../components/layout'
import { toHex, toIter, verifySignature } from '../../cardano/serialization-lib'
import { getResult, useCardanoSerializationLib } from '../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../components/status'
import { NativeScriptViewer, SignatureSync, SignTxButton, SubmitTxButton, TransactionBodyViewer } from '../../components/transaction'
import type { Vkeywitness } from '@adaocommunity/cardano-serialization-lib-browser'
import { useContext, useState } from 'react'
import { PencilAltIcon } from '@heroicons/react/solid'
import { ConfigContext } from '../../cardano/config'

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
    <Panel>
      <textarea
        className='block w-full p-4 outline-none'
        rows={4}
        value={signature}
        onChange={(e) => setSignature(e.target.value)}
        placeholder="Signature">
      </textarea>
      <footer className='flex p-4 bg-gray-100 space-x-2'>
        <button
          onClick={manualSignHandle}
          disabled={isDisabled}
          className='flex items-center space-x-1 p-2 disabled:border rounded-md bg-sky-700 text-white disabled:bg-gray-100 disabled:text-gray-500'>
          <PencilAltIcon className='h-6' />
          <span>Manual Sign</span>
        </button>
        {children}
      </footer>
    </Panel>
  )
}

const GetTransaction: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query
  const cardano = useCardanoSerializationLib()
  const [signatureMap, setSignatureMap] = useState<Map<string, Vkeywitness>>(new Map())
  const [config, _] = useContext(ConfigContext)

  if (!cardano) return <Loading />;

  if (typeof base64CBOR !== 'string') return <ErrorMessage>Invalid Transaction CBOR</ErrorMessage>;
  const txResult = getResult(() => cardano.lib.Transaction.from_bytes(Buffer.from(base64CBOR, 'base64')))
  if (!txResult.isOk) return <ErrorMessage>Invalid transaction</ErrorMessage>;

  const transaction = txResult.data
  const txHash = cardano.lib.hash_transaction(transaction.body())
  const witnessSet = transaction.witness_set()
  const nativeScriptSet = witnessSet.native_scripts()
  const signerRegistry = new Set<string>()
  nativeScriptSet && Array.from(toIter(nativeScriptSet), (script) => {
    Array.from(toIter(script.get_required_signers()), (signer) => signerRegistry.add(toHex(signer)))
  })

  const txMessage = cardano.getTxMessage(transaction)

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
        const publicKey = vkeyWitness.vkey().public_key()
        const keyHash = publicKey.hash()
        const hex = toHex(keyHash)
        if (signerRegistry.has(hex) && verifySignature(txHash, vkeyWitness)) {
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
        {txMessage && <Panel>
          <div className='p-4'>{txMessage.map((line, index) => <p key={index}>{line}</p>)}</div>
        </Panel>}
        {nativeScriptSet && Array.from(toIter(nativeScriptSet), (script, index) =>
          <Panel className='p-4'>
            <NativeScriptViewer cardano={cardano} script={script} signatures={signatureMap} key={index} />
          </Panel>
        )}
        <ManualSign signHandle={signHandle}>
          <SignTxButton
            transaction={transaction}
            partialSign={true}
            signHandle={signHandle}
            wallet='nami'
            className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-transparent disabled:text-gray-500' />
          <SignTxButton
            transaction={transaction}
            partialSign={true}
            signHandle={signHandle}
            wallet='gero'
            className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-transparent disabled:text-gray-500' />
          <SignTxButton
            transaction={transaction}
            partialSign={true}
            signHandle={signHandle}
            wallet='eternl'
            className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-transparent disabled:text-gray-500' />
          <SignTxButton
            transaction={transaction}
            partialSign={true}
            signHandle={signHandle}
            wallet='flint'
            className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-transparent disabled:text-gray-500' />
          <div className='flex grow justify-end items-center space-x-4'>
            <SignatureSync
              cardano={cardano}
              txHash={txHash}
              signatures={signatureMap}
              signHandle={signHandle}
              signers={signerRegistry}
              config={config} />
            <SubmitTxButton
              className='py-2 px-4 font-semibold bg-sky-700 text-white rounded disabled:bg-gray-100 disabled:text-gray-500'
              transaction={signedTransaction}>
              Submit Transaction
            </SubmitTxButton>
          </div>
        </ManualSign>
      </div>
    </Layout>
  )
}

export default GetTransaction
