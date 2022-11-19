import type { FC, ReactNode, MouseEventHandler } from 'react'

const Modal: FC<{
  className?: string
  children: ReactNode
  onBackgroundClick?: MouseEventHandler<HTMLDivElement>
}> = ({ className, children, onBackgroundClick }) => {
  return (
    <div onClick={onBackgroundClick} className='absolute bg-black bg-opacity-50 inset-0 flex justify-center items-center'>
      <div onClick={(e) => e.stopPropagation()} className={className}>
        {children}
      </div>
    </div>
  )
}

export { Modal }
