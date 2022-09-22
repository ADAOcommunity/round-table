import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { ErrorMessage } from '../../components/status'
import { TransactionViewer } from '../../components/transaction'

const GetTransaction: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query

  if (typeof base64CBOR !== 'string') return <ErrorMessage>Invalid Transaction CBOR</ErrorMessage>;

  return (
    <TransactionViewer content={Buffer.from(base64CBOR, 'base64')} />
  )
}

export default GetTransaction
