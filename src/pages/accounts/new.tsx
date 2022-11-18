import type { NextPage } from 'next'
import { useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import { Hero, Layout } from '../../components/layout'
import { Loading } from '../../components/status'
import { EditAccount } from '../../components/account'

const NewAccount: NextPage = () => {
  const cardano = useCardanoMultiplatformLib()

  if (!cardano) return <Loading />;

  return (
    <Layout>
      <div className='space-y-2'>
        <Hero>
          <h1 className='font-semibold text-lg'>New Account</h1>
          <p>Start to create an account protected by Multi-Sig native scripts from here by adding signer addresses or by setting timelocks. Only receiving addresses from one of our supported wallets should be used. Check the homepage for further information.</p>
        </Hero>
        <EditAccount cardano={cardano} />
      </div>
    </Layout>
  )
}

export default NewAccount
