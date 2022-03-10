import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout, Panel } from '../../components/layout'
import { CardanoSet, toHex } from '../../cardano/serialization-lib'
import { getResult, mapCardanoSet, useCardanoSerializationLib } from '../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../components/status'
import { NativeScriptViewer, SignTxButton, TransactionBodyViewer } from '../../components/transaction'
import type { NativeScript, Vkeywitness } from '@emurgo/cardano-serialization-lib-browser'
import { useEffect, useState } from 'react'

import GUN from "gun";
var testMap = new Map();

const GetTransaction: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query
  const cardano = useCardanoSerializationLib()
  const [signatureMap, setSignatureMap] = useState<Map<string, Vkeywitness>>(new Map())
  const [inputSignature, setInputSignature] = useState('')

  const gun = GUN(['https://dao-gunjs.herokuapp.com/gun'])

  var loadedSigners: string[] = []
  var loadedMap: Map<string, Vkeywitness> = new Map();

  useEffect(() => {
    if (cardano && base64CBOR) {
      //------------ GUN JS ----------------------------
      gun.get(base64CBOR as string).map().once((data) => {
        console.log(data)
       // loadedMap=signatureMap;
        try {
          let hexVal = data?.hex
          let sig: string = data?.sig
          if (!loadedSigners.includes(sig)) {
            loadedSigners.push(sig)
            var bytes = Buffer.from(sig, 'hex')
            var witness = cardano.lib.TransactionWitnessSet.from_bytes(bytes)
            const vkeyWitnessSet: CardanoSet<Vkeywitness> | undefined = witness?.vkeys()
            vkeyWitnessSet && mapCardanoSet(vkeyWitnessSet, (vkeyWitness) => {
              loadedMap.set(hexVal, vkeyWitness)
              //setSignatureMap(loadedMap)
            })
          }
        } catch (e) {
          console.log(e)
        }
      })
      setTimeout(() => {
        setSignatureMap(loadedMap)
      }, 3000)
      
      // ------------------------------------------------
    }
  }, [cardano])


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
    console.log("signHandle")
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
        let sig = cardano.buildSingleSignatureHex(newMap.get(toHex(keyHash)) as Vkeywitness)

        gun.get(base64CBOR).set({ hex: hex, sig: sig })
      }
    });
  }

  const manualSignHandle = () => {
    signHandle(inputSignature)
    setInputSignature('')
  }

  return (
    <Layout>
      <div className='space-y-2'>
        <TransactionBodyViewer txBody={transaction.body()} />
        {nativeScriptSet && mapCardanoSet(nativeScriptSet, (script, index) =>
          <NativeScriptViewer cardano={cardano} script={script} signatures={signatureMap} key={index} />
        )}
        <Panel title='Signature'>
          <div className='p-4'>
            <textarea
              className='block w-full border rounded-md p-2'
              rows={4}
              value={inputSignature}
              onChange={(e) => setInputSignature(e.target.value)}
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
            <button onClick={manualSignHandle} className='p-2 border rounded-md bg-blue-300'>
              Manual Sign
            </button>
          </footer>
        </Panel>
      </div>
    </Layout>
  )
}

export default GetTransaction
