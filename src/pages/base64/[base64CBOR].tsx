import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout, Modal } from '../../components/layout'
import { Loading } from '../../components/status'
import { TransactionViewer } from '../../components/transaction'

const GetTransaction: NextPage = () => {
  const router = useRouter()
  const { base64CBOR } = router.query

  if (typeof base64CBOR !== 'string') return null

  return (
    <Layout>
      {!base64CBOR && <Modal><Loading /></Modal>}
      {base64CBOR && <TransactionViewer content={Buffer.from(base64CBOR, 'base64')} />}
    </Layout>
  )
}

export default GetTransaction
