import { useMemo, useContext, useEffect, useState, useCallback } from 'react'
import type { ChangeEventHandler, MouseEventHandler, FC, ReactNode } from 'react'
import ReactDOM from 'react-dom'
import Link from 'next/link'
import { CogIcon, FolderOpenIcon, HomeIcon, PlusIcon, UserGroupIcon, WalletIcon } from '@heroicons/react/24/solid'
import { ConfigContext, isMainnet } from '../cardano/config'
import type { Config } from '../cardano/config'
import { NotificationCenter } from './notification'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { MultisigWallet, PersonalWallet, Policy } from '../db'
import { useRouter } from 'next/router'
import Image from 'next/image'
import { getBalanceByPaymentAddresses, sumValues, usePaymentAddressesQuery } from '../cardano/query-api'
import type { Value } from '../cardano/query-api'
import { ADAAmount } from './currency'
import { ChainProgress } from './time'
import { getMultisigWalletPath, getPersonalWalletPath } from '../route'
import { SpinnerIcon } from './status'
import { useCardanoMultiplatformLib } from '../cardano/multiplatform-lib'

const Toggle: FC<{
  isOn: boolean
  onChange: ChangeEventHandler<HTMLInputElement>
}> = ({ isOn, onChange }) => {
  return (
    <label className='cursor-pointer'>
      <input className='hidden peer' type='checkbox' checked={isOn} onChange={onChange} />
      <div className='flex border w-12 items-center rounded-full border-gray-500 bg-gray-500 peer-checked:bg-green-500 peer-checked:border-green-500 peer-checked:justify-end'>
        <div className='h-6 w-6 rounded-full bg-white'></div>
      </div>
    </label>
  )
}

const Panel: FC<{
  children: ReactNode
  className?: string
}> = ({ children, className }) => {
  return (
    <div className={['border-t-4 border-sky-700 bg-white rounded shadow overflow-hidden', className].join(' ')}>
      {children}
    </div>
  )
}

const CopyButton: FC<{
  className?: string
  children: ReactNode
  copied?: ReactNode
  disabled?: boolean
  content?: string
  ms?: number
}> = ({ children, copied, className, disabled, content, ms }) => {
  const [isCopied, setIsCopied] = useState(false)

  const click = useCallback(() => {
    if (!content) return
    navigator.clipboard.writeText(content)
    setIsCopied(true)
  }, [content])

  useEffect(() => {
    let isMounted = true

    const timer = setTimeout(() => {
      if (isMounted && isCopied) setIsCopied(false)
    }, ms)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [isCopied, ms])

  return (
    <button className={className} disabled={disabled || isCopied || !content} onClick={click}>
      {isCopied ? (copied ?? 'Copied!') : children}
    </button>
  )
}

const ShareCurrentURLButton: FC<{
  className?: string
  children: ReactNode
}> = ({ children, className }) => {
  const [currentURL, setCurrentURL] = useState<string | undefined>()
  useEffect(() => setCurrentURL(document.location.href), [])

  return (
    <CopyButton className={className} content={currentURL} ms={500}>
      {children}
    </CopyButton>
  )
}

const BackButton: FC<{
  className?: string
  children: ReactNode
}> = ({ children, className }) => {
  const router = useRouter()
  return <button className={className} onClick={() => router.back()}>{children}</button>;
}

const NavLink: FC<{
  className?: string
  children: ReactNode
  href: string
  onPageClassName: string
}> = ({ children, className, href, onPageClassName }) => {
  const router = useRouter()
  const isOnPage = useMemo(() => {
    const route = router.route
    const parentPaths = href.split('/')
    const currentPaths = route.split('/')
    return href === route || parentPaths.every((name, index) => name === currentPaths[index])
  }, [href, router.route])

  return (
    <Link href={href}>
      <a className={[className, isOnPage ? onPageClassName : ''].join(' ')}>
        {children}
      </a>
    </Link>
  )
}

const PrimaryBar: FC = () => {
  return (
    <aside className='flex flex-col w-20 bg-sky-900 items-center text-white'>
      <NavLink
        href='/'
        onPageClassName='bg-sky-700'
        className='p-4 hover:bg-sky-700'>
        <HomeIcon className='w-12' />
      </NavLink>
      <NavLink
        href='/open'
        onPageClassName='bg-sky-700'
        className='p-4 hover:bg-sky-700'>
        <FolderOpenIcon className='w-12' />
      </NavLink>
      <NavLink
        href='/config'
        onPageClassName='bg-sky-700'
        className='p-4 hover:bg-sky-700'>
        <CogIcon className='w-12' />
      </NavLink>
      <a className='p-4 hover:bg-sky-700' target='_blank' rel='noreferrer' href='https://discord.gg/BGuhdBXQFU'>
        <div style={{ height: '48px' }}>
          <Image src='/Discord-Logo-White.svg' width={48} height={48} alt='Discord Server'></Image>
        </div>
      </a>
      <a className='p-4 hover:bg-sky-700' target='_blank' rel='noreferrer' href='https://github.com/ADAOcommunity/round-table'>
        <svg className='w-12 fill-white' viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" transform="scale(64)" />
        </svg>
      </a>
    </aside>
  )
}

const WalletLink: FC<{
  name: string
  href: string
  lovelace?: bigint
  isOnPage: boolean
  children?: ReactNode
}> = ({ name, href, lovelace, isOnPage, children }) => {
  return (
    <Link href={href}>
      <a className={['flex space-x-1 justify-between items-center p-4 hover:bg-sky-700', isOnPage ? 'bg-sky-100 text-sky-700 font-semibold rounded-l' : ''].join(' ')}>
        <div className='w-2/3'>
          <div className='truncate'>{name}</div>
          <div className='text-sm font-normal'>
            {lovelace !== undefined ? <ADAAmount lovelace={lovelace} /> : <SpinnerIcon className='animate-spin w-4' />}
          </div>
        </div>
        <div>{children}</div>
      </a>
    </Link>
  )
}

const PersonalWalletListing: FC<{
  wallet: PersonalWallet
  balances?: Map<string, Value>
}> = ({ wallet, balances }) => {
  const cardano = useCardanoMultiplatformLib()
  const [config, _] = useContext(ConfigContext)
  const router = useRouter()
  const isOnPage: boolean = useMemo(() => router.query.personalWalletId === wallet.id.toString(), [router.query.personalWalletId, wallet.id])
  const addresses: string[] | undefined = useMemo(() => {
    if (!cardano) return
    return Array.from(wallet.personalAccounts.values())
      .flatMap((account) => cardano.getAddressesFromPersonalAccount(account, isMainnet(config)))
  }, [cardano, wallet.personalAccounts, config])
  const balance: Value | undefined = useMemo(() => {
    if (!addresses || !balances) return
    const values: Value[] = []
    addresses.forEach((address) => {
      const value = balances.get(address)
      if (value) values.push(value)
    })
    return sumValues(values)
  }, [addresses, balances])

  return (
    <WalletLink href={getPersonalWalletPath(wallet.id)} name={wallet.name} isOnPage={isOnPage} lovelace={balance?.lovelace}>
      <WalletIcon className='w-8' />
    </WalletLink>
  )
}

const MultisigWalletListing: FC<{
  wallet: MultisigWallet
  balance?: Value
}> = ({ wallet, balance }) => {
  const [config, _] = useContext(ConfigContext)
  const cardano = useCardanoMultiplatformLib()
  const router = useRouter()
  const lovelace = balance?.lovelace
  const isOnPage: boolean = useMemo(() => {
    const policyContent = router.query.policy
    if (typeof policyContent === 'string') {
      const policy: Policy = JSON.parse(policyContent)
      const id = cardano?.getPolicyAddress(policy, isMainnet(config)).to_bech32()
      if (id) return id === wallet.id
    }
    return false
  }, [cardano, config, router.query.policy, wallet.id])

  return (
    <WalletLink href={getMultisigWalletPath(wallet.policy)} name={wallet.name} isOnPage={isOnPage} lovelace={lovelace}>
      <UserGroupIcon className='w-8' />
    </WalletLink>
  )
}

const WalletList: FC = () => {
  const [config, _] = useContext(ConfigContext)
  const cardano = useCardanoMultiplatformLib()
  const multisigWallets = useLiveQuery(async () => db.multisigWallets.toArray())
  const personalWallets = useLiveQuery(async () => db.personalWallets.toArray())
  const addresses: string[] = useMemo(() => {
    const result = new Set<string>()
    if (!cardano) return []
    multisigWallets?.forEach(({ id }) => result.add(id))
    personalWallets?.forEach(({ personalAccounts }) => {
      personalAccounts.forEach((account) =>
        cardano.getAddressesFromPersonalAccount(account, isMainnet(config)).forEach((address) => result.add(address)))
    })
    return Array.from(result)
  }, [multisigWallets, personalWallets, config, cardano])
  const { data } = usePaymentAddressesQuery({
    variables: { addresses },
    fetchPolicy: 'cache-first',
    pollInterval: 10000,
    skip: addresses.length === 0
  })
  const balances: Map<string, Value> | undefined = useMemo(() => {
    if (!data) return

    const balanceMap = new Map<string, Value>()
    data.paymentAddresses.forEach((paymentAddress) => {
      const address = paymentAddress.address
      const balance = getBalanceByPaymentAddresses([paymentAddress])
      balanceMap.set(address, balance)
    })

    return balanceMap
  }, [data])

  return (
    <aside className='flex flex-col w-60 bg-sky-800 items-center text-white overflow-y-auto'>
      <nav className='w-full font-semibold'>
        <NavLink
          href='/new'
          onPageClassName='bg-sky-700'
          className='flex w-full p-4 items-center space-x-1 justify-center hover:bg-sky-700'>
          <PlusIcon className='w-4' />
          <span>New Wallet</span>
        </NavLink>
      </nav>
      <nav className='block w-full'>
        {personalWallets?.map((wallet) => <PersonalWalletListing key={wallet.id} wallet={wallet} balances={balances} />)}
        {multisigWallets?.map((wallet) => <MultisigWalletListing key={wallet.id} wallet={wallet} balance={balances?.get(wallet.id)} />)}
      </nav>
    </aside>
  )
}

const getCardanoScanHost = (config: Config): string => {
  switch (config.network) {
    case 'mainnet': return 'https://cardanoscan.io'
    case 'testnet': return 'https://testnet.cardanoscan.io'
    case 'preview': return 'https://preview.cardanoscan.io'
  }
}

const CardanoScanLink: FC<{
  className?: string
  children: ReactNode
  type: 'transaction' | 'pool'
  id: string
}> = ({ className, children, type, id }) => {
  const [config, _] = useContext(ConfigContext)
  const host = getCardanoScanHost(config)
  const href = new URL([type, id].join('/'), host)
  return <a className={className} href={href.toString()} target='_blank' rel='noreferrer'>{children}</a>;
}

const Hero: FC<{
  className?: string
  children: ReactNode
}> = ({ className, children }) => {
  return <div className={['rounded p-4 bg-sky-700 text-white shadow space-y-4', className].join(' ')}>{children}</div>;
}

const Portal: FC<{
  id: string
  children: ReactNode
}> = ({ id, children }) => {
  const [root, setRoot] = useState<HTMLElement | null>()

  useEffect(() => {
    setRoot(document.getElementById(id))
  }, [id])

  if (!root) return null

  return ReactDOM.createPortal(children, root)
}

const Layout: FC<{
  children: ReactNode
}> = ({ children }) => {
  const [config, _] = useContext(ConfigContext)

  return (
    <div className='flex h-screen'>
      <PrimaryBar />
      <WalletList />
      <div className='w-full bg-sky-100 overflow-y-auto'>
        {!isMainnet(config) && <div className='p-1 bg-red-900 text-white text-center'>You are using {config.network} network</div>}
        <div className='p-2 h-screen space-y-2'>
          <ChainProgress />
          {children}
        </div>
      </div>
      <div id='modal-root'></div>
      <div className='flex flex-row-reverse'>
        <NotificationCenter className='fixed space-y-2 w-1/4 p-4' />
      </div>
    </div>
  )
}

const Modal: FC<{
  className?: string
  children: ReactNode
  onBackgroundClick?: MouseEventHandler<HTMLDivElement>
}> = ({ className, children, onBackgroundClick }) => {
  return (
    <Portal id='modal-root'>
      <div onClick={onBackgroundClick} className='absolute bg-black bg-opacity-50 inset-0 flex justify-center items-center'>
        <div onClick={(e) => e.stopPropagation()} className={className}>
          {children}
        </div>
      </div>
    </Portal>
  )
}

const PasswordBox: FC<{
  title: string
  children: ReactNode
  disabled?: boolean
  onConfirm: (password: string) => void
}> = ({ title, children, disabled, onConfirm }) => {
  const [password, setPassword] = useState('')
  const confirm = useCallback(() => {
    onConfirm(password)
  }, [onConfirm, password])

  return (<>
    <label className='block px-4 py-6 space-y-4'>
      <div className='font-semibold'>{title}</div>
      <input
        type='password'
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder='Password'
        className='block w-full border rounded p-1 text-center text-lg outline-none' />
    </label>
    <nav>
      <button
        disabled={disabled || password.length === 0}
        onClick={confirm}
        className='flex w-full p-2 space-x-1 items-center justify-center text-white bg-sky-700 disabled:bg-gray-100 disabled:text-gray-500'>
        {children}
      </button>
    </nav>
  </>)
}

const AskPasswordModalButton: FC<{
  className?: string
  title: string
  disabled?: boolean
  children?: ReactNode
  onConfirm: (password: string) => void
}> = ({ className, title, disabled, children, onConfirm }) => {
  const [modal, setModal] = useState(false)
  const closeModal = useCallback(() => setModal(false), [])
  const confirm = useCallback((password: string) => {
    onConfirm(password)
    closeModal()
  }, [closeModal, onConfirm])

  return (
    <>
      <button onClick={() => setModal(true)} className={className}>{children}</button>
      {modal && <Modal className='bg-white divide-y text-center rounded w-full overflow-hidden md:w-1/3 lg:w-1/4 xl:w-1/6' onBackgroundClick={closeModal}>
        <PasswordBox
          disabled={disabled}
          title={title}
          onConfirm={confirm}>
          Confirm
        </PasswordBox>
      </Modal>}
    </>
  )
}

const ConfirmModalButton: FC<{
  className?: string
  children?: ReactNode
  disabled?: boolean
  message?: string
  onConfirm: () => void
}> = ({ className, children, onConfirm, message, disabled }) => {
  const [modal, setModal] = useState(false)
  const closeModal = useCallback(() => setModal(false), [])
  const confirm = useCallback(() => {
    onConfirm()
    closeModal()
  }, [closeModal, onConfirm])

  return (
    <>
      <button onClick={() => setModal(true)} className={className} disabled={disabled}>{children}</button>
      {modal && <Modal className='bg-white p-4 rounded space-y-4 text-sm w-full md:w-1/3 lg:w-1/4' onBackgroundClick={closeModal}>
        <h2 className='text-center text-lg font-semibold'>Please Confirm</h2>
        <div className='text-center text-lg'>{message}</div>
        <nav className='flex justify-end space-x-2'>
          <button className='border rounded p-2 text-sky-700' onClick={closeModal}>Cancel</button>
          <button onClick={confirm} className={className} disabled={disabled}>{children}</button>
        </nav>
      </Modal>}
    </>
  )
}

export { Layout, Panel, Toggle, Hero, BackButton, CardanoScanLink, CopyButton, ShareCurrentURLButton, Portal, Modal, AskPasswordModalButton, ConfirmModalButton, PasswordBox }
