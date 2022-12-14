import type { FC } from 'react'

const Loading: FC = () => (
  <div className='px-8 py-4 text-xl items-center space-x-2 bg-white text-sky-700 rounded flex'>
    <SpinnerIcon className='animate-spin w-5' />
    <span>Loading...</span>
  </div>
)

const PartialLoading: FC = () => {
  return (
    <SpinnerIcon className='animate-spin w-6 text-sky-700' />
  )
}

const ProgressBar: FC<{
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

const SpinnerIcon: FC<{
  className?: string
}> = ({ className }) => {
  return (
    <svg className={className} xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
      <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
      <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
    </svg>
  )
}

export { Loading, PartialLoading, ProgressBar, SpinnerIcon }
