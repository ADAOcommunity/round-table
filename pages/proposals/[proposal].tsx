import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import Layout from '../../components/layout'
import { useCardanoSerializationLib } from '../../cardano/serialization-lib'

const GetProposal: NextPage = () => {
  const router = useRouter()
  const { proposal } = router.query
  const cardano = useCardanoSerializationLib()

  if (!cardano) return <div className='text-center'>Loading Cardano Serialization Lib</div>
  if (typeof proposal !== 'string') return <div></div>

  console.log(cardano.decodeTxBody(proposal))

  return (
    <Layout>
    </Layout>
  )
}

export default GetProposal
