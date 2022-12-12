import type { NextPage } from 'next'
import { useCardanoMultiplatformLib } from '../cardano/multiplatform-lib'
import type { Cardano } from '../cardano/multiplatform-lib'
import { Hero, Layout, Modal, Panel } from '../components/layout'
import { isPasswordStrong, PasswordInput, StrongPasswordInput } from '../components/password'
import { Loading } from '../components/status'
import { EditMultisigWallet } from '../components/wallet'
import { useCallback, useContext, useMemo, useState } from 'react'
import type { ChangeEventHandler, FC } from 'react'
import { createPersonalWallet, db } from '../db'
import type { MultisigWalletParams, PersonalWallet } from '../db'
import { mnemonicToEntropy, generateMnemonic, wordlists } from 'bip39'
import { useLiveQuery } from 'dexie-react-hooks'
import { NotificationContext } from '../components/notification'
import { encryptWithPassword, SHA256Digest } from '../cardano/utils'
import type { Bip32PrivateKey } from '@dcspark/cardano-multiplatform-lib-browser'
import { useRouter } from 'next/router'
import { getPersonalWalletPath } from '../route'

const NewMultisigWallet: FC = () => {
  const cardano = useCardanoMultiplatformLib()
  const params: MultisigWalletParams = useMemo(() => {
    return {
      name: '',
      description: '',
      policy: { type: 'All', policies: [] }
    }
  }, [])

  if (!cardano) return (
    <Modal><Loading /></Modal>
  )

  return (
    <EditMultisigWallet cardano={cardano} params={params} />
  )
}

const NewRecoveryPhrase: FC<{
  className?: string
  cancel?: () => void
  confirm: () => void
}> = ({ className, cancel, confirm }) => {
  const strength = 256
  const length = 24
  const words: string[] = useMemo(() => {
    const phrase = generateMnemonic(strength)
    const words = phrase.trim().split(/\s+/g)
    if (words.length !== length) throw new Error(`Invalid phrase: ${phrase}`)
    return words
  }, [])

  return (
    <div className={className}>
      <header>
        <h2 className='text-lg font-semibold'>Recovery Phrase</h2>
        <p>Make sure you write down the 24 words of your wallet recover phase <strong className='font-semibold'>on a piece of paper in the exact order shown here</strong>.</p>
      </header>
      <ul className='grid grid-cols-3 gap-2'>
        {words.map((word, index) => <li key={index} className='flex border rounded divide-x'>
          <div className='flex-none w-9 text-right px-2 py-1 tabular-nums bg-gray-100'>{index + 1}</div>
          <div className='grow text-sky-700 font-bold px-2 py-1'>{word}</div>
        </li>)}
      </ul>
      <footer className='flex justify-end space-x-2'>
        {cancel && <button className='border rounded text-sky-700 border rounded p-2' onClick={cancel}>Cancel</button>}
        <button className='border rounded bg-sky-700 text-white p-2' onClick={confirm}>Yes, I have written it down.</button>
      </footer>
    </div>
  )
}

const WordInput: FC<{
  index: number
  word: string
  setWord: (index: number, word: string) => void
  wordset: Set<string>
}> = ({ index, setWord, word, wordset }) => {
  const onChange: ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    setWord(index, event.target.value)
  }, [setWord, index])
  const valid = useMemo(() => wordset.has(word), [wordset, word])
  const className = useMemo(() => [
    'flex divide-x border rounded overflow-hidden focus-within:ring-1',
    valid ? 'ring-sky-500' : 'text-red-500'].join(' '), [valid])

  return (
    <li className={className} key={index}>
      <div className='flex-none w-9 text-right px-2 py-1 tabular-nums text-black bg-gray-100'>{index + 1}</div>
      <input
        className='grow w-full font-bold px-2 py-1'
        list='bip39-wordlist'
        value={word}
        onChange={onChange} />
    </li>
  )
}

const RecoverHDWallet: FC<{
  cardano: Cardano
  setRootKey: (key: Bip32PrivateKey) => void
}> = ({ cardano, setRootKey }) => {
  const { notify } = useContext(NotificationContext)
  const language = 'english'
  const wordset: Set<string> = useMemo(() => new Set(wordlists[language]), [language])
  const length = 24
  const [words, setWords] = useState<string[]>(new Array(length).fill(''))
  const setWord = useCallback((index: number, word: string) => setWords(words.map((w, i) => index === i ? word : w)), [words])
  const [BIP32Passphrase, setBIP32Passphrase] = useState<string>('')
  const [repeatBIP32Passphrase, setRepeatBIP32Passphrase] = useState<string>('')
  const [modal, setModal] = useState<'new' | undefined>()
  const closeModal = useCallback(() => setModal(undefined), [])
  const openModal = useCallback(() => setModal('new'), [])
  const isPhraseValid = useMemo(() => words.length === length && words.every((word) => wordset.has(word)), [words, wordset])
  const buildKey = useCallback(async () => {
    if (!isPhraseValid) throw new Error('Invalid recover phrase')
    if (BIP32Passphrase !== repeatBIP32Passphrase) throw new Error('Passphrases do not match')
    const phrase = words.join(' ')
    const entropy = Buffer.from(mnemonicToEntropy(phrase), 'hex')
    const key = cardano.lib.Bip32PrivateKey.from_bip39_entropy(entropy, Buffer.from(BIP32Passphrase, 'utf8'))
    return SHA256Digest(key.as_bytes())
      .then(async (buffer) => {
        const hash = new Uint8Array(buffer)
        const duplicate = await db.personalWallets.get({ hash })
        if (duplicate) throw new Error(`This phrase is a duplicate of ${duplicate.name}`)
      })
      .then(() => setRootKey(key))
      .catch((error) => notify('error', error))
  }, [cardano, BIP32Passphrase, repeatBIP32Passphrase, isPhraseValid, notify, setRootKey, words])

  return (
    <Panel>
      <div className='p-4 space-y-2'>
        <h2 className='text-lg font-semibold'>Recovery Phrase</h2>
        <ul className='grid grid-cols-3 xl:grid-cols-4 gap-2'>
          {words.map((word, index) => <WordInput key={index} word={word} setWord={setWord} index={index} wordset={wordset} />)}
        </ul>
        <datalist id='bip39-wordlist'>
          {Array.from(wordset, (word, index) => <option key={index} value={word} />)}
        </datalist>
        <div>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-2'>
            <PasswordInput
              placeholder='BIP39 optional passphrase'
              password={BIP32Passphrase}
              setPassword={setBIP32Passphrase} />
            <PasswordInput
              invalid={BIP32Passphrase !== repeatBIP32Passphrase}
              placeholder='Repeat passphrase'
              password={repeatBIP32Passphrase}
              setPassword={setRepeatBIP32Passphrase} />
          </div>
        </div>
        <nav>
          <button className='py-1 px-2 border rounded text-sm text-sky-700' onClick={openModal}>Generate Recovery Phrase</button>
          {modal === 'new' && <Modal className='bg-white p-4 rounded w-full md:w-1/2 lg:w-1/3' onBackgroundClick={closeModal}>
            <NewRecoveryPhrase className='space-y-2' confirm={closeModal} />
          </Modal>}
        </nav>
      </div>
      <footer className='flex justify-end p-4 bg-gray-100'>
        <button
          disabled={!isPhraseValid || BIP32Passphrase !== repeatBIP32Passphrase || !isPhraseValid}
          onClick={buildKey}
          className='px-4 py-2 bg-sky-700 text-white rounded disabled:border disabled:text-gray-400 disabled:bg-gray-100'>
          Next
        </button>
      </footer>
    </Panel>
  )
}

const SavePersonalWallet: FC<{
  id: number
  cardano: Cardano
  rootKey: Bip32PrivateKey
}> = ({ cardano, rootKey, id }) => {
  const { notify } = useContext(NotificationContext)
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')

  const create = useCallback(async () => {
    const rootKeyBytes = rootKey.as_bytes()
    const hash = new Uint8Array(await SHA256Digest(rootKeyBytes))

    encryptWithPassword(rootKeyBytes, password, id)
      .then(async (ciphertext) => {
        const wallet: PersonalWallet = {
          id, name, description, hash,
          rootKey: new Uint8Array(ciphertext),
          personalAccounts: new Map(),
          multisigAccounts: new Map(),
          updatedAt: new Date()
        }
        const personalIndices = await cardano.generatePersonalAccount(wallet, password, 0)
        const multisigIndices = await cardano.generateMultisigAccount(wallet, password, 0)
        const keyHashIndices = [personalIndices, multisigIndices].flat()
        createPersonalWallet(wallet, keyHashIndices).then(() => router.push(getPersonalWalletPath(id)))
      })
      .catch((error) => {
        notify('error', 'Failed to save the key')
        console.error(error)
      })
  }, [cardano, description, id, name, notify, password, rootKey, router])

  return (
    <Panel>
      <div className='p-4 space-y-2'>
        <label className='block space-y-1'>
          <div className="after:content-['*'] after:text-red-500">Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='p-2 block border w-full rounded ring-sky-500 focus:ring-1'
            placeholder='Write Name' />
        </label>
        <div className='space-y-1'>
          <div className="after:content-['*'] after:text-red-500">Signing Password</div>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-2'>
            <StrongPasswordInput password={password} setPassword={setPassword} placeholder='Password' />
            <PasswordInput
              invalid={password !== repeatPassword}
              password={repeatPassword}
              setPassword={setRepeatPassword}
              placeholder='Repeat password' />
          </div>
        </div>
        <label className='block space-y-1'>
          <div>Description</div>
          <textarea
            className='p-2 block border w-full rounded ring-sky-500 focus:ring-1'
            placeholder='Describe the wallet'
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}>
          </textarea>
        </label>
      </div>
      <footer className='flex justify-end p-4 bg-gray-100'>
        <button
          disabled={!isPasswordStrong(password) || password !== repeatPassword}
          onClick={create}
          className='px-4 py-2 bg-sky-700 text-white rounded disabled:border disabled:text-gray-400 disabled:bg-gray-100'>
          Create
        </button>
      </footer>
    </Panel>
  )
}

const NewPersonalWallet: FC = () => {
  const cardano = useCardanoMultiplatformLib()
  const id = useLiveQuery(async () => db.personalWallets.count())
  const [rootKey, setRootKey] = useState<Bip32PrivateKey | undefined>()

  if (!cardano || id === undefined) return (
    <Modal><Loading /></Modal>
  )

  if (!rootKey) return (
    <RecoverHDWallet cardano={cardano} setRootKey={setRootKey} />
  )

  return (
    <SavePersonalWallet cardano={cardano} id={id} rootKey={rootKey} />
  )
}

const NewWallet: NextPage = () => {
  const [tab, setTab] = useState<'multisig' | 'personal'>('multisig')

  return (
    <Layout>
      <Hero>
        <h1 className='font-semibold text-lg'>New Wallet</h1>
        <p>Start to create an account protected by Multi-Sig native scripts from here by adding signer addresses or by setting timelocks. Only receiving addresses from one of our supported wallets should be used. Check the homepage for further information.</p>
        <div className='flex'>
          <nav className='text-sm rounded border-white border divide-x overflow-hidden'>
            <button
              onClick={() => setTab('multisig')}
              disabled={tab === 'multisig'}
              className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
              Multisig
            </button>
            <button
              onClick={() => setTab('personal')}
              disabled={tab === 'personal'}
              className='px-2 py-1 disabled:bg-white disabled:text-sky-700'>
              Personal
            </button>
          </nav>
        </div>
      </Hero>
      {tab === 'multisig' && <NewMultisigWallet />}
      {tab === 'personal' && <NewPersonalWallet />}
    </Layout>
  )
}

export default NewWallet
