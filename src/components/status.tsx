import type { NextPage } from 'next'

const StatusPage: NextPage = ({ children }) => {
  return (
    <div className='flex min-h-screen bg-sky-100 justify-center items-center'>
      <div className='bg-white rounded-md shadow'>{children}</div>
    </div>
  )
}

const ErrorMessage: NextPage = ({ children }) => (
  <StatusPage>
    <p className='px-8 py-4 text-lg text-white bg-red-900 rounded'>{children}</p>
  </StatusPage>
)

const Loading = () => (
  <StatusPage>
    <p className='px-8 py-4 text-lg items-center space-x-2'>Loading...</p>
  </StatusPage>
)

const ProgressBar: NextPage<{
  className?: string
  max: number
  value: number
}> = ({ max, value, className }) => {
  const progress = value / max * 100
  const style = { width: `${progress}%` }

  return (
    <div className={className} style={style}></div>
  )
}

export { ErrorMessage, Loading, ProgressBar }
