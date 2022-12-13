import { useContext } from 'react'
import type { FC, ReactNode } from 'react'
import { ClipboardDocumentCheckIcon, ClipboardDocumentIcon, MagnifyingGlassCircleIcon } from '@heroicons/react/24/solid'
import { CopyButton } from './layout'
import { ConfigContext } from '../cardano/config'
import type { Config } from '../cardano/config'

const getCardanoScanHost = (config: Config): string => {
  switch (config.network) {
    case 'mainnet': return 'https://cardanoscan.io'
    case 'testnet': return 'https://testnet.cardanoscan.io'
    case 'preview': return 'https://preview.cardanoscan.io'
  }
}

type CardanoScanType =
  | 'address'
  | 'stakekey'
  | 'transaction'
  | 'pool'

const CardanoScanLink: FC<{
  className?: string
  children: ReactNode
  scanType: CardanoScanType
  id: string
}> = ({ className, children, scanType, id }) => {
  const [config, _] = useContext(ConfigContext)
  const host = getCardanoScanHost(config)
  const href = new URL([scanType, id].join('/'), host)
  return <a className={className} href={href.toString()} target='_blank' rel='noreferrer'>{children}</a>;
}

const AddressableContent: FC<{
  content: string
  scanType?: CardanoScanType
}> = ({ content, scanType }) => {
  return (
    <div className='break-all space-x-1'>
      <span>{content}</span>
      <nav className='inline-block text-sky-700 space-x-1 align-middle'>
        <CopyButton
          className='inline-block'
          copied={<ClipboardDocumentCheckIcon className='w-4 text-green-500' />}
          ms={1000}
          content={content}>
          <ClipboardDocumentIcon className='w-4' />
        </CopyButton>
        {scanType && <CardanoScanLink className='inline-block' id={content} scanType={scanType}>
          <MagnifyingGlassCircleIcon className='w-4' />
        </CardanoScanLink>}
      </nav>
    </div>
  )
}

export { AddressableContent, CardanoScanLink }
