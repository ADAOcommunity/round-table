import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import Layout from '../../components/layout'
import { useCardanoSerializationLib } from '../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../components/status'
import { TransactionViewer } from '../../components/transaction'

const GetProposal: NextPage = () => {
  const router = useRouter()
  const { proposal } = router.query
  const cardano = useCardanoSerializationLib()

  if (!cardano) return <Loading />;
  if (typeof proposal !== 'string') return <ErrorMessage>Invalid transaction body</ErrorMessage>;

  const txBody = cardano.decodeTxBody(proposal)
  return (
    <Layout>
      <TransactionViewer txBody={txBody} />
    </Layout>
  )
}

export default GetProposal
