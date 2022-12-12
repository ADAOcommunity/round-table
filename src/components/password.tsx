import { useMemo, useState, useCallback } from 'react'
import type { ChangeEventHandler, KeyboardEvent, FC, ReactNode, HTMLInputTypeAttribute } from 'react'
import { CheckIcon, EyeIcon, EyeSlashIcon, KeyIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { Modal, useEnterPressListener } from './layout'

const PasswordInput: FC<{
  password: string
  setPassword: (password: string) => void
  placeholder?: string
  onEnter?: (event: KeyboardEvent) => void
  invalid?: boolean
  onFocus?: () => void
  onBlur?: () => void
}> = ({ password, setPassword, placeholder, onEnter, invalid, onFocus, onBlur }) => {
  const [isVisible, setIsVisible] = useState(false)
  const inputType: HTMLInputTypeAttribute = useMemo(() => isVisible ? 'text' : 'password', [isVisible])
  const onChange: ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    setPassword(event.target.value)
  }, [setPassword])
  const toggle = useCallback(() => setIsVisible(!isVisible), [isVisible])
  const pressEnter = useEnterPressListener((event) => {
    onEnter && onEnter(event)
  })
  const className = useMemo(() => invalid ? 'text-red-500 ring-red-500' : 'ring-sky-500', [invalid])

  return (
    <label className={['flex w-full border rounded items center focus-within:ring-1', className].join(' ')}>
      <div className='p-2'>
        <KeyIcon className='w-4 text-yellow-400' />
      </div>
      <input
        className='w-full'
        onFocus={onFocus}
        onBlur={onBlur}
        value={password}
        placeholder={placeholder}
        type={inputType}
        onKeyDown={pressEnter}
        onChange={onChange} />
      <button onClick={toggle} className='block p-2'>
        {isVisible && <EyeIcon className='w-4 text-sky-700' />}
        {!isVisible && <EyeSlashIcon className='w-4 text-sky-700' />}
      </button>
    </label>
  )
}

const MIN_LENGTH = 8
const MIN_UPPERCASE = 2
const MIN_LOWERCASE = 2
const MIN_DIGITS = 2
const MIN_SPECIALS = 2

type PasswordTester = (password: string) => boolean

const testPasswordLength: PasswordTester = (password) => password.length >= MIN_LENGTH
const testPasswordUpperCase: PasswordTester = (password) => (password.match(/[A-Z]/g)?.length ?? 0) >= MIN_UPPERCASE
const testPasswordLowerCase: PasswordTester = (password) => (password.match(/[a-z]/g)?.length ?? 0) >= MIN_LOWERCASE
const testPasswordDigits: PasswordTester = (password) => (password.match(/\d/g)?.length ?? 0) >= MIN_DIGITS
const testPasswordSpecials: PasswordTester = (password) => (password.match(/\W/g)?.length ?? 0) >= MIN_SPECIALS

const testPasswordSuits: PasswordTester[] = [
  testPasswordLength,
  testPasswordUpperCase,
  testPasswordLowerCase,
  testPasswordDigits,
  testPasswordSpecials
]

const testPasswordDesc: string[] = [
  `Minimum ${MIN_LENGTH} characters`,
  `${MIN_UPPERCASE} uppercase letters`,
  `${MIN_LOWERCASE} lowercase letters`,
  `${MIN_DIGITS} digits`,
  `${MIN_SPECIALS} special characters, e.g. #-?[]()`
]

const isPasswordStrong: PasswordTester = (password) => testPasswordSuits.every((fn) => fn(password))

const PasswordCheckItem: FC<{
  tester: PasswordTester
  description: string
  password: string
}> = ({ tester, description, password }) => {
  const valid = useMemo(() => tester(password), [tester, password])
  const className = useMemo(() => ['flex space-x-1 items-center', valid ? 'text-green-500' : 'text-red-500'].join(' '), [valid])
  return (
    <li className={className}>
      {valid && <CheckIcon className='w-4' />}
      {!valid && <XMarkIcon className='w-4' />}
      <span>{description}</span>
    </li>
  )
}

const PasswordStrenghCheck: FC<{
  className?: string
  password: string
}> = ({ className, password }) => {
  return (
    <ul className={className}>
      {testPasswordSuits.map((tester, index) => (
        <PasswordCheckItem
          key={index}
          tester={tester}
          description={testPasswordDesc[index]}
          password={password} />
      ))}
    </ul>
  )
}

const StrongPasswordInput: FC<{
  password: string
  setPassword: (password: string) => void
  placeholder?: string
}> = ({ password, setPassword, placeholder }) => {
  const [tips, setTips] = useState(false)
  const openTips = useCallback(() => setTips(true), [])
  const closeTips = useCallback(() => setTips(false), [])
  const invalid = useMemo(() => !isPasswordStrong(password), [password])

  return (
    <div className='relative space-y-1'>
      <PasswordInput
        invalid={invalid}
        onFocus={openTips}
        onBlur={closeTips}
        placeholder={placeholder}
        password={password}
        setPassword={setPassword} />
      {tips && <div className='absolute'>
        <PasswordStrenghCheck
          className='p-4 border bg-white rounded shadow w-80'
          password={password} />
      </div>}
    </div>
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
    <div className='block px-4 py-6 space-y-6'>
      <div className='font-semibold'>{title}</div>
      <PasswordInput
        password={password}
        setPassword={setPassword}
        onEnter={confirm}
        placeholder='Password' />
    </div>
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
      {modal && <Modal className='bg-white divide-y text-center rounded w-80 overflow-hidden' onBackgroundClick={closeModal}>
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

export { PasswordInput, StrongPasswordInput, AskPasswordModalButton, PasswordBox, testPasswordLength, testPasswordUpperCase, testPasswordLowerCase, testPasswordDigits, testPasswordSpecials, isPasswordStrong }
