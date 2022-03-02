import type { NextPage } from 'next'
import Layout from "./layout"

const ErrorPage: NextPage = ({ children }) => {
  return (
    <Layout>
      <div className='flex h-screen justify-center items-center'>
        <div className='bg-white rounded-md shadow'>{children}</div>
      </div>
    </Layout>
  )
}

export { ErrorPage }
