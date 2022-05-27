import type { FC, ReactNode } from 'react'

const Modal: FC<{
  className?: string
  children: ReactNode
  onClose: () => void
  isOpen: boolean
}> = ({ className, children, isOpen, onClose }) => {
  if (!isOpen) return null
  return (
    <div onClick={onClose} className='absolute bg-black bg-opacity-50 inset-0 flex justify-center items-center'>
      <div onClick={(e) => e.stopPropagation()} className={className}>
        {children}
      </div>
    </div>
  )
}

export default Modal
