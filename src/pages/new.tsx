import type { NextPage } from 'next'
import { useCardanoMultiplatformLib, getResult } from '../cardano/multiplatform-lib'
import type { Result } from '../cardano/multiplatform-lib'
import { Hero, Layout, Modal, Panel } from '../components/layout'
import { Loading } from '../components/status'
import { EditMultisigWallet } from '../components/wallet'
import { useContext, useEffect, useMemo, useState } from 'react'
import type { FC } from 'react'
import { createWallet, db } from '../db'
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

const RecoverHDWallet: FC<{
  className?: string
  setRootKey: (key: Bip32PrivateKey | undefined) => void
}> = ({ className, setRootKey }) => {
  const language = 'english'
  const wordset: Set<string> = useMemo(() => new Set(wordlists[language]), [language])
  const length = 24
  const [words, setWords] = useState<string[]>(new Array(length).fill(''))
  const setWord = (index: number, word: string) => setWords(words.map((w, i) => index === i ? word : w))
  const cardano = useCardanoMultiplatformLib()
  const [BIP32Passphrase, setBIP32Passphrase] = useState<string>('')
  const [repeatBIP32Passphrase, setRepeatBIP32Passphrase] = useState<string>('')
  const isBIP32PassphraseValid = BIP32Passphrase === repeatBIP32Passphrase
  const rootKeyResult: Result<Bip32PrivateKey | undefined> = useMemo(() => getResult(() => {
    const isValid = words.length === length && words.every((word) => wordset.has(word)) && isBIP32PassphraseValid
    if (!isValid) return
    const phrase = words.join(' ')
    const entropy = Buffer.from(mnemonicToEntropy(phrase), 'hex')
    return cardano?.lib.Bip32PrivateKey.from_bip39_entropy(entropy, Buffer.from(BIP32Passphrase, 'utf8'))
  }), [BIP32Passphrase, cardano?.lib.Bip32PrivateKey, isBIP32PassphraseValid, words, wordset])
  const [modal, setModal] = useState<'new' | undefined>()
  const closeModal = () => setModal(undefined)
  useEffect(() => {
    if (rootKeyResult.isOk) setRootKey(rootKeyResult.data)
  }, [rootKeyResult, setRootKey])

  return (
    <div className={className}>
      {!rootKeyResult.isOk && <div className='text-white bg-red-700 p-2 rounded'>{rootKeyResult.message}</div>}
      <ul className='grid grid-cols-3 gap-2'>
        {words.map((word, index) => <li className='flex divide-x border rounded overflow-hidden' key={index}>
          <div className='flex-none w-9 text-right px-2 py-1 tabular-nums bg-gray-100'>{index + 1}</div>
          <input
            className={['grow w-full font-bold px-2 py-1 outline-none', wordset.has(word) ? 'text-sky-700' : 'text-red-500'].join(' ')}
            list='bip39-wordlist'
            value={word}
            onChange={(e) => setWord(index, e.target.value)} />
        </li>)}
      </ul>
      <datalist className='appearance-none' id='bip39-wordlist'>
        {Array.from(wordset, (word, index) => <option key={index} value={word} />)}
      </datalist>
      <div>
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-2'>
          <input
            type='password'
            className='block border rounded p-1 outline-none'
            value={BIP32Passphrase}
            onChange={(e) => setBIP32Passphrase(e.target.value)}
            placeholder='BIP39 optional passphrase' />
          <input
            type='password'
            className={['block border rounded p-1 outline-none', isBIP32PassphraseValid ? '' : 'text-red-500'].join(' ')}
            value={repeatBIP32Passphrase}
            onChange={(e) => setRepeatBIP32Passphrase(e.target.value)}
            placeholder='Repeat passphrase' />
        </div>
        {!isBIP32PassphraseValid && <div className='text-red-500'>Passphrases do not match.</div>}
      </div>
      <footer>
        <button className='py-1 px-2 border rounded text-sm text-sky-700' onClick={() => setModal('new')}>Generate Recovery Phrase</button>
        {modal === 'new' && <Modal className='bg-white p-4 rounded w-full md:w-1/2 lg:w-1/3' onBackgroundClick={closeModal}>
          <NewRecoveryPhrase className='space-y-2' confirm={closeModal} />
        </Modal>}
      </footer>
    </div>
  )
}

const NewPersonalWallet: FC = () => {
  const cardano = useCardanoMultiplatformLib()
  const { notify } = useContext(NotificationContext)
  const router = useRouter()
  const id = useLiveQuery(async () => db.personalWallets.count())
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rootKey, setRootKey] = useState<Bip32PrivateKey | undefined>()
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const isValid = password === repeatPassword && password.length > 0 && name.length > 0 && rootKey !== undefined && id !== undefined && cardano
  const add = async () => {
    if (!isValid) return

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
        db.transaction('rw', db.personalWallets, db.keyHashIndices, () => createWallet(wallet, keyHashIndices))
          .then(() => router.push(getPersonalWalletPath(id)))
      })
      .catch((error) => {
        notify('error', 'Failed to save the key')
        console.error(error)
      })
  }

  return (
    <Panel>
      <div className='p-4 space-y-2'>
        <h2 className='text-lg font-semibold'>Recover Personal Wallet</h2>
        <label className='block space-y-1'>
          <div className="after:content-['*'] after:text-red-500">Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='p-2 block border w-full rounded'
            placeholder='Write Name' />
        </label>
        <label className='block space-y-1'>
          <div>Description</div>
          <textarea
            className='p-2 block border w-full rounded'
            placeholder='Describe the wallet'
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}>
          </textarea>
        </label>
        <div className='space-y-1'>
          <div className="after:content-['*'] after:text-red-500">Signing Password</div>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-2'>
            <input
              type='password'
              className='block border rounded p-1 outline-none'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='Password used when signing transaction' />
            <input
              type='password'
              className={['block border rounded p-1 outline-none', password === repeatPassword ? '' : 'text-red-500'].join(' ')}
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              placeholder='Repeat password' />
          </div>
        </div>
        <div className='space-y-1'>
          <div className="after:content-['*'] after:text-red-500">Recovery Phrase</div>
          <div className='grid grid-cols-2 gap-2'>
            <RecoverHDWallet className='space-y-2' setRootKey={setRootKey} />
          </div>
        </div>
      </div>
      <footer className='flex justify-end p-4 bg-gray-100'>
        <button
          disabled={!isValid}
          onClick={add}
          className='px-4 py-2 bg-sky-700 text-white rounded disabled:border disabled:text-gray-400 disabled:bg-gray-100'>
          Create
        </button>
      </footer>
    </Panel>
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
