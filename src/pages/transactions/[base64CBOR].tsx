import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Hero, Layout, Panel, ShareCurrentURLButton } from '../../components/layout'
import { toHex, toIter, verifySignature } from '../../cardano/multiplatform-lib'
import { getResult, useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import { ErrorMessage, Loading } from '../../components/status'
import { CopyVkeysButton, SignatureSync, SignTxButton, SubmitTxButton, TransactionBodyViewer } from '../../components/transaction'
import type { Vkeywitness } from '@dcspark/cardano-multiplatform-lib-browser'
import { useContext, useState } from 'react'
import { ShareIcon, UploadIcon } from '@heroicons/react/solid'
import { ConfigContext } from '../../cardano/config'
import { NativeScriptViewer } from '../../components/native-script'
import type { VerifyingData } from '../../components/native-script'

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
        placeholder="Input signature here and import">
      </textarea>
      <footer className='flex p-4 bg-gray-100 space-x-2'>
        <button
          onClick={manualSignHandle}
          disabled={isDisabled}
          className='flex items-center space-x-1 p-2 disabled:border rounded-md bg-sky-700 text-white disabled:bg-gray-100 disabled:text-gray-400'>
          <UploadIcon className='w-4' />
          <span>Import</span>
        </button>
        {children}
      </footer>
    </Panel>
  )
}

const GetTransaction: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query
  const cardano = useCardanoMultiplatformLib()
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

  // TODO: query the necessary data like slot number
  const verifyingData: VerifyingData = { signatures: signatureMap, currentSlot: 0 }
  const signedTransaction = cardano.signTransaction(transaction, signatureMap.values())

  return (
    <Layout>
      <div className='space-y-2'>
        <Hero>
          <h1 className='font-semibold text-lg'>Review Transaction</h1>
          <p>Share current page URL to other signers so they can sign. After you have signed the transaction, you may copy your signatures to others to import. If the auto sync switch is on, your signatures would be exchanged automatically.</p>
          <nav>
            <ShareCurrentURLButton
              className='flex space-x-1 bg-white text-sky-700 py-1 px-2 rounded shadow w-32 justify-center items-center'>
              <ShareIcon className='w-4' />
              <span>Copy URL</span>
            </ShareCurrentURLButton>
          </nav>
        </Hero>
        <TransactionBodyViewer cardano={cardano} txBody={transaction.body()} />
        {txMessage && <Panel className='space-y-1 p-4'>
          <div className='font-semibold'>Message</div>
          <div>{txMessage.map((line, index) => <p key={index}>{line}</p>)}</div>
        </Panel>}
        {nativeScriptSet && Array.from(toIter(nativeScriptSet), (script, index) =>
          <Panel key={index}>
            <NativeScriptViewer
              verifyingData={verifyingData}
              className='p-4 space-y-2'
              headerClassName='font-semibold'
              ulClassName='space-y-1'
              nativeScript={script} />
            <footer className='flex p-4 bg-gray-100 space-x-2 justify-between'>
              <div className='flex space-x-1 items-center'>
                <SignatureSync
                  cardano={cardano}
                  txHash={txHash}
                  signatures={signatureMap}
                  signHandle={signHandle}
                  signers={signerRegistry}
                  config={config} />
                <div className='text-sm'>Auto sync the signatures with other signers</div>
              </div>
              <CopyVkeysButton
                cardano={cardano}
                vkeys={Array.from(signatureMap.values())}
                className='flex space-x-1 justify-center items-center p-2 border text-sky-700 rounded w-48 disabled:text-gray-400'>
                <ShareIcon className='w-4' />
                <span>Copy my signatures</span>
              </CopyVkeysButton>
            </footer>
          </Panel>
        )}
        <ManualSign signHandle={signHandle}>
          <SignTxButton
            transaction={transaction}
            partialSign={true}
            signHandle={signHandle}
            name='nami'
            className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-gray-100 disabled:text-gray-400' />
          <SignTxButton
            transaction={transaction}
            partialSign={true}
            signHandle={signHandle}
            name='gero'
            className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-gray-100 disabled:text-gray-400' />
          <SignTxButton
            transaction={transaction}
            partialSign={true}
            signHandle={signHandle}
            name='eternl'
            className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-gray-100 disabled:text-gray-400' />
          <SignTxButton
            transaction={transaction}
            partialSign={true}
            signHandle={signHandle}
            name='flint'
            className='flex items-center space-x-1 p-2 disabled:border rounded bg-sky-700 text-white disabled:bg-gray-100 disabled:text-gray-400' />
          <div className='flex grow justify-end items-center space-x-4'>
            <SubmitTxButton
              className='py-2 px-4 font-semibold bg-sky-700 text-white rounded disabled:border disabled:bg-gray-100 disabled:text-gray-400'
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
