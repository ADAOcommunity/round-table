import type { NextPage } from 'next'

const StatusPage: NextPage = ({ children }) => {
  return (
    <div className='flex min-h-screen bg-gradient-to-br from-slate-100 to-blue-100 justify-center items-center'>
      <div className='bg-white rounded-md shadow'>{children}</div>
    </div>
  )
}

const ErrorMessage: NextPage = ({ children }) => (
  <StatusPage>
    <p className='p-8 text-lg text-red-900'>{children}</p>
  </StatusPage>
)

const Loading = () => <StatusPage><p className='p-8 text-lg text-gray-900'>Loading...</p></StatusPage>;

export { ErrorMessage, Loading }
