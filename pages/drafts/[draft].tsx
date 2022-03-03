import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import Layout from '../../components/layout'
import { useCardanoSerializationLib } from '../../cardano/serialization-lib'

const GetDraft: NextPage = () => {
  const router = useRouter()
  const { draft } = router.query
  const cardano = useCardanoSerializationLib()

  if (!cardano) return <div className='text-center'>Loading Cardano Serialization Lib</div>
  if (typeof draft !== 'string') return <div></div>

  console.log(cardano.decodeTxBody(draft))

  return (
    <Layout>
    </Layout>
  )
}

export default GetDraft
