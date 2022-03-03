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

const LoadingPage: NextPage = ({ children }) => {
  return (
    <div className='flex min-h-screen bg-gradient-to-br from-slate-100 to-blue-100 justify-center items-center'>
      <div className='bg-white rounded-md shadow'>{children}</div>
    </div>
  )
}

const ErrorMessage: NextPage = ({ children }) => (
  <ErrorPage>
    <p className='p-4 font-bold text-lg text-red-600'>{children}</p>
  </ErrorPage>
)

const Loading = () => <LoadingPage><p className='p-8 text-lg text-gray-900'>Loading...</p></LoadingPage>

export { ErrorPage, ErrorMessage, Loading, LoadingPage }
