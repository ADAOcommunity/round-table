import { useMemo, useContext, useEffect, useState } from 'react'
import type { ChangeEventHandler, MouseEventHandler, FC, ReactNode } from 'react'
import ReactDOM from 'react-dom'
import Link from 'next/link'
import { CogIcon, FolderOpenIcon, HomeIcon, PlusIcon } from '@heroicons/react/24/solid'
import { ConfigContext } from '../cardano/config'
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
  getContent: () => string
  ms?: number
}> = ({ children, copied, className, disabled, getContent, ms }) => {
  const [isCopied, setIsCopied] = useState(false)

  const clickHandle = () => {
    navigator.clipboard.writeText(getContent())
    setIsCopied(true)
  }

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
    <button className={className} disabled={disabled || isCopied} onClick={clickHandle}>
      {isCopied ? (copied ?? 'Copied!') : children}
    </button>
  )
}

const ShareCurrentURLButton: FC<{
  className?: string
  children: ReactNode
}> = ({ children, className }) => {
  return (
    <CopyButton className={className} getContent={() => document.location.href} ms={500}>
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
}> = ({ name, href, lovelace, isOnPage }) => {
  return (
    <Link href={href}>
      <a className={['block p-4 hover:bg-sky-700', isOnPage ? 'bg-sky-100 text-sky-700 font-semibold rounded-l' : ''].join(' ')}>
        <div className='truncate'>{name}</div>
        <div className='text-sm font-normal'>
          {lovelace !== undefined ? <ADAAmount lovelace={lovelace} /> : <SpinnerIcon className='animate-spin w-4' />}
        </div>
      </a>
    </Link>
  )
}

const PersonalWalletListing: FC<{
  wallet: PersonalWallet
  balances: Map<string, Value>
}> = ({ wallet, balances }) => {
  const cardano = useCardanoMultiplatformLib()
  const [config, _] = useContext(ConfigContext)
  const router = useRouter()
  const isOnPage: boolean = useMemo(() => router.query.personalWalletId === wallet.id.toString(), [router.query.personalWalletId, wallet.id])
  const addresses: string[] | undefined = useMemo(() => {
    if (!cardano) return
    return wallet
      .personalAccounts
      .flatMap((account, index) => cardano.getAddressesFromPersonalAccount(account, index, config.isMainnet).map((item) => item.address))
  }, [cardano, wallet.personalAccounts, config.isMainnet])
  const balance: Value | undefined = useMemo(() => {
    if (!addresses) return
    const values: Value[] = []
    addresses.forEach((address) => {
      const value = balances.get(address)
      if (value) values.push(value)
    })
    return sumValues(values)
  }, [addresses, balances])

  return (
    <WalletLink href={getPersonalWalletPath(wallet.id)} name={wallet.name} isOnPage={isOnPage} lovelace={balance?.lovelace} />
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
      const id = cardano?.getPolicyAddress(policy, config.isMainnet).to_bech32()
      if (id) return id === wallet.id
    }
    return false
  }, [cardano, config.isMainnet, router.query.policy, wallet.id])

  return (
    <WalletLink href={getMultisigWalletPath(wallet.policy)} name={wallet.name} isOnPage={isOnPage} lovelace={lovelace} />
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
      personalAccounts.forEach((account, index) =>
        cardano.getAddressesFromPersonalAccount(account, index, config.isMainnet).forEach(({ address }) => result.add(address)))
    })
    return Array.from(result)
  }, [multisigWallets, personalWallets, config.isMainnet, cardano])
  const { data } = usePaymentAddressesQuery({
    variables: { addresses },
    fetchPolicy: 'cache-first',
    pollInterval: 10000,
    skip: addresses.length === 0
  })
  const balances: Map<string, Value> = useMemo(() => {
    const balanceMap = new Map<string, Value>()
    data?.paymentAddresses.forEach((paymentAddress) => {
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
        {multisigWallets?.map((wallet) => <MultisigWalletListing key={wallet.id} wallet={wallet} balance={balances.get(wallet.id)} />)}
      </nav>
    </aside>
  )
}

const CardanoScanLink: FC<{
  className?: string
  children: ReactNode
  type: 'transaction'
  id: string
}> = ({ className, children, type, id }) => {
  const [config, _] = useContext(ConfigContext)
  const host = config.isMainnet ? 'https://cardanoscan.io' : 'https://testnet.cardanoscan.io'
  const href = [host, type, id].join('/')
  return <a className={className} href={href} target='_blank' rel='noreferrer'>{children}</a>;
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
        {!config.isMainnet && <div className='p-1 bg-red-900 text-white text-center'>You are using testnet</div>}
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

export { Layout, Panel, Toggle, Hero, BackButton, CardanoScanLink, CopyButton, ShareCurrentURLButton, Portal, Modal }
