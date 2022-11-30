import type { NextPage } from 'next'
import { Hero, Layout, Modal } from '../components/layout'
import { PlusIcon } from '@heroicons/react/24/solid'
import { useMemo, useState } from 'react'
import type { FC } from 'react'
import { mnemonicToEntropy, generateMnemonic, wordlists } from 'bip39'
import { getResult, useCardanoMultiplatformLib } from '../cardano/multiplatform-lib'
import type { Result } from '../cardano/multiplatform-lib'

const NewRootKey: FC<{
  className?: string
  cancel: () => void
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
          <div className='flex-none w-9 text-right px-2 py-1 tabular-nums'>{index + 1}</div>
          <div className='grow text-sky-700 font-bold px-2 py-1'>{word}</div>
        </li>)}
      </ul>
      <footer className='flex justify-end space-x-2'>
        <button className='border rounded text-sky-700 border rounded p-2' onClick={cancel}>Cancel</button>
        <button className='border rounded bg-sky-700 text-white p-2' onClick={confirm}>Yes, I have written it down.</button>
      </footer>
    </div>
  )
}

const RecoverRootKey: FC<{
  className?: string
  cancel: () => void
}> = ({ className, cancel }) => {
  const language = 'english'
  const wordset: Set<string> = useMemo(() => new Set(wordlists[language]), [language])
  const length = 24
  const [words, setWords] = useState<string[]>(new Array(length).fill(''))
  const setWord = (index: number, word: string) => setWords(words.map((w, i) => index === i ? word : w))
  const cardano = useCardanoMultiplatformLib()
  const [BIP32Passphrase, setBIP32Passphrase] = useState<string>('')
  const [repeatBIP32Passphrase, setRepeatBIP32Passphrase] = useState<string>('')
  const isBIP32PassphraseValid = BIP32Passphrase === repeatBIP32Passphrase
  const rootKeyResult: Result<Uint8Array | undefined> = useMemo(() => getResult(() => {
    const isValid = words.length === length && words.every((word) => wordset.has(word)) && isBIP32PassphraseValid
    if (!isValid) return
    const phrase = words.join(' ')
    const entropy = Buffer.from(mnemonicToEntropy(phrase), 'hex')
    return cardano?.lib.Bip32PrivateKey.from_bip39_entropy(entropy, Buffer.from(BIP32Passphrase, 'utf8')).as_bytes()
  }), [BIP32Passphrase, cardano?.lib.Bip32PrivateKey, isBIP32PassphraseValid, words, wordset])
  const rootKey: Uint8Array | undefined = useMemo(() => {
    if (rootKeyResult.isOk) return rootKeyResult.data
  }, [rootKeyResult])

  return (
    <div className={className}>
      <header>
        <h2 className='text-lg font-semibold'>Recover Root Key</h2>
      </header>
      {!rootKeyResult.isOk && <div className='text-white bg-red-700 p-2 rounded'>{rootKeyResult.message}</div>}
      <ul className='grid grid-cols-3 gap-2'>
        {words.map((word, index) => <li className='flex divide-x border rounded overflow-hidden' key={index}>
          <div className='flex-none w-9 text-right px-2 py-1 tabular-nums'>{index + 1}</div>
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
      <footer className='flex justify-end space-x-2'>
        <button className='border rounded text-sky-700 border rounded p-2' onClick={cancel}>Cancel</button>
        <button className='border rounded bg-sky-700 text-white p-2 disabled:bg-gray-100 disabled:text-gray-300' disabled={!rootKey}>Recover</button>
      </footer>
    </div>
  )
}

const ListKeys: NextPage = () => {
  const [modal, setModal] = useState<'new' | 'recover' | undefined>()
  const closeModal = () => setModal(undefined)

  return (
    <Layout>
      <Hero>
        <h1 className='font-semibold text-lg'>Key Management</h1>
        <p>Manage keys.</p>
        <nav className='flex'>
          <button
            onClick={() => setModal('new')}
            className='flex space-x-1 bg-white text-sky-700 py-1 px-2 rounded shadow w-32 justify-center items-center'>
            <PlusIcon className='w-4' />
            <span>Create Key</span>
          </button>
        </nav>
      </Hero>
      {modal === 'new' && <Modal className='bg-white p-4 rounded w-full md:w-1/2 lg:w-1/3' onBackgroundClick={closeModal}>
        <NewRootKey className='space-y-2' cancel={closeModal} confirm={() => setModal('recover')} />
      </Modal>}
      {modal === 'recover' && <Modal className='bg-white p-4 rounded w-full md:w-1/2 lg:w-1/3' onBackgroundClick={closeModal}>
        <RecoverRootKey className='space-y-2' cancel={closeModal} />
      </Modal>}
      <div></div>
    </Layout>
  )
}

export default ListKeys
