import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Layout } from '../../../components/layout'
import { getResult, useCardanoSerializationLib } from '../../../cardano/serialization-lib'
import { ErrorMessage, Loading } from '../../../components/status'
import { TransactionViewer } from '../../../components/transaction'

const GetProposal: NextPage = () => {
  const router = useRouter()
  const { treasury, proposal } = router.query
  const cardano = useCardanoSerializationLib()

  if (!cardano) return <Loading />;

  if (typeof treasury !== 'string') return <ErrorMessage>Invalid script</ErrorMessage>;
  const scriptResult = getResult(() => cardano.lib.NativeScript.from_bytes(Buffer.from(treasury, 'base64')))
  if (!scriptResult.isOk) return <ErrorMessage>Invalid script</ErrorMessage>;

  if (typeof proposal !== 'string') return <ErrorMessage>Invalid transaction body</ErrorMessage>;
  const txBodyResult = getResult(() => cardano.lib.TransactionBody.from_bytes(Buffer.from(proposal, 'base64')))
  if (!txBodyResult.isOk) return <ErrorMessage>Invalid transaction body</ErrorMessage>;

  return (
    <Layout>
      <TransactionViewer txBody={txBodyResult.data} />
    </Layout>
  )
}

export default GetProposal
