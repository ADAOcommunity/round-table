import type { NextPage } from 'next'

const Modal: NextPage<{
  isOpen: boolean
  className?: string
  onClose: () => void
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
