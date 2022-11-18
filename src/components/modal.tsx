import type { FC, ReactNode } from 'react'

const Modal: FC<{
  className?: string
  children: ReactNode
  onClose: () => void
}> = ({ className, children, onClose }) => {
  return (
    <div onClick={onClose} className='absolute bg-black bg-opacity-50 inset-0 flex justify-center items-center'>
      <div onClick={(e) => e.stopPropagation()} className={className}>
        {children}
      </div>
    </div>
  )
}

export default Modal
