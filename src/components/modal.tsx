import { FC, ReactNode, MouseEventHandler, useState, useEffect } from 'react'
import ReactDOM from 'react-dom'

const Modal: FC<{
  className?: string
  children: ReactNode
  onBackgroundClick?: MouseEventHandler<HTMLDivElement>
}> = ({ className, children, onBackgroundClick }) => {
  const [root, setRoot] = useState<HTMLElement | null>()

  useEffect(() => {
    let isMounted = true

    isMounted && setRoot(document.getElementById('modal-root'))

    return () => {
      isMounted = false
    }
  }, [])

  if (!root) return null

  const element = (
    <div onClick={onBackgroundClick} className='absolute bg-black bg-opacity-50 inset-0 flex justify-center items-center'>
      <div onClick={(e) => e.stopPropagation()} className={className}>
        {children}
      </div>
    </div>
  )

  return ReactDOM.createPortal(element, root)
}

export { Modal }
