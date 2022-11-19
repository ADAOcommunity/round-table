import type { NextPage } from 'next'
import { Hero, Layout, Panel } from '../components/layout'
import { getResult, useCardanoMultiplatformLib } from '../cardano/multiplatform-lib'
import { SpinnerIcon } from '../components/status'
import { useMemo, useState } from 'react'
import { TransactionReviewButton } from '../components/transaction'

const parseText = (text: string): Uint8Array => {
  try {
    let url = new URL(text)
    let [_, encoding, content] = url.pathname.split('/')

    if (encoding === 'base64') return Buffer.from(decodeURIComponent(content), 'base64')
    if (encoding === 'hex') return Buffer.from(content, 'hex')

    throw new Error(`Unknow encoding: ${encoding}`)
  } catch (e) {
    return Buffer.from(text, 'hex')
  }
}

const GetTransaction: NextPage = () => {
  const [text, setText] = useState('')
  const cardano = useCardanoMultiplatformLib()
  const txResult = useMemo(() => {
    if (!cardano) return

    return getResult(() => {
      return cardano.lib.Transaction.from_bytes(parseText(text))
    })
  }, [cardano, text])

  if (txResult && !txResult.isOk) console.log(txResult.message)

  return (
    <Layout>
      <Hero>
        <h1 className='font-semibold text-lg'>Open Transaction</h1>
        <p>Open a transaction created by others.</p>
      </Hero>
      <Panel>
        <textarea
          className='block w-full p-4 outline-none'
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='URL or CBOR in Hex'>
        </textarea>
        {text && <footer className='flex p-4 bg-gray-100 space-x-2'>
          {txResult && !txResult.isOk && <div className='text-red-500'>Invalid Transaction</div>}
          {txResult?.isOk && <TransactionReviewButton className='px-4 py-2 rounded' transaction={txResult.data} />}
        </footer>}
      </Panel>
    </Layout>
  )
}

export default GetTransaction
