import type { NextPage } from 'next'
import Image from 'next/image'
import { Layout, Panel } from '../components/layout'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid'

const flintLogo = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkwIiBoZWlnaHQ9IjE5MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBmaWxsPSJub25lIj4KIDxnPgogIDx0aXRsZT5MYXllciAxPC90aXRsZT4KICA8cGF0aCBkPSJtNTYuMDExLDU5LjM4NWw0My40NjIyLC00NC4wODMzYzIuOTcwOCwtMy4yNTM0IDQuMDMxOCwtMi45MzY1IDUuMDQ0OCwwLjc4NzJsMC4zODgsMzEuNDg4MWMtMC4xMDgsNC45MTM2IC0wLjQ2NSw3LjAzMjYgLTEuOTQsOS4wNTI4bC0yNi4zODgxLDI3LjE1ODVjLTMuNDUwNCw0LjI2NjcgLTIuOTc2OSw1Ljk2OTggLTMuMTA0NCw3Ljg3MmMtMC4xMjc2LDEuOTAyMiAzLjM1NzQsNy40NDg0IDkuMzEzMyw3Ljg3MjFjMCwwIDE2LjE1MDUsMC4wMDMzIDE3Ljg1MDIsMGMxLjcsLTAuMDAzNCAyLjg5MSwyLjczNDYgMCw1LjUxMDZsLTM2LjQ3NjksMzYuNjA1Yy00LjUxNDMsNC4yNTIgLTcuMDY4LDQuMjQgLTExLjY0MTYsMi43NTVjLTcuMDE5NiwtMy45MzUgLTcuMTQ1LC03LjU2NyAtNy4zNjM4LC0xMy45MDFsLTAuMDA5MywtMC4yNjlsMCwtNDAuMTQ3MWMtMC4yNDMxLC0xMi43OTgzIDEuNTg2NiwtMTkuNjE4MSAxMC44NjU2LC0zMC43MDA5eiIgZmlsbD0iI0ZGNjEwMCIgaWQ9InN2Z18xIi8+CiAgPHBhdGggZD0ibTEzNC43MSwxMzEuNTlsLTQ0Ljc3ODgsNDQuMDgzYy0zLjA2MTEsMy4yNTQgLTQuMTU0LDIuOTM3IC01LjE5NzYsLTAuNzg3bC0wLjM5OTgsLTMxLjQ4OGMwLjExMDcsLTQuOTEzIC0wLjA3NTMsLTIuOTk4NTcgNi4zNTAyNiwtMTAuOTI0MjRsMjIuODM1OTQsLTI1LjI4Njc2YzMuNTU1LC00LjI2NyAzLjA2NywtNS45NyAzLjE5OSwtNy44NzIyYzAuMTMxLC0xLjkwMjIgLTMuNDU5LC03LjQ0ODQgLTkuNTk2LC03Ljg3MjFjMCwwIC0xNi42Mzk3LC0wLjAwMzMgLTE4LjM5MTMsMGMtMS43NTE1LDAuMDAzNCAtMi45Nzg3LC0yLjczNSAwLC01LjUxMDRsMzcuNTgyMywtMzYuNjA1YzQuNjUxLC00LjI1MjMgNy4yODMsLTQuMjQwNSAxMS45OTUsLTIuNzU1MmM3LjIzMiwzLjkzNSA3LjM2MSw3LjU2NzQgNy41ODcsMTMuOTAxM2wwLjAwOSwwLjI2ODRsMCw0MC4xNDcyYzAuMjUxLDEyLjc5OSAtMS42MzQsMTkuNjE4IC0xMS4xOTUsMzAuNzAxeiIgZmlsbD0iI0ZGNjEwMCIgaWQ9InN2Z18yIi8+CiA8L2c+Cgo8L3N2Zz4='

const Home: NextPage = () => {
  return (
    <Layout>
      <div className='space-y-2'>
        <Panel className='p-4 space-y-2'>
          <h1 className='text-lg font-semibold'>Round Table</h1>
          <p>Round Table is ADAO Community’s open-source wallet on Cardano blockchain. It aims at making multisig easy and intuitive for everyone. The project is designed and developed with decentralization in mind. All the libraries and tools were chosen in favor of decentralization. There is no server to keep your data. Your data is your own. It runs on your browser just like any other light wallets. You could also run it on your own PC easily.</p>
          <p>Round Table supports multisig wallets as well as personal wallets. Besides its personal wallets, these wallets are supported to make multisig wallets.</p>
          <div className='border rounded w-80 shadow'>
            <table className='table-fixed w-full'>
              <caption className='bg-gray-100 p-1 font-semibold'>Multisig Support</caption>
              <thead className='bg-gray-100 border-b'>
                <tr>
                  <th className='p-2'>Wallet</th>
                  <th className='p-2'>Payment</th>
                  <th className='p-2'>Staking</th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                <tr>
                  <td>
                    <div className='flex items-center justify-center space-x-1 p-1'>
                      <Image src='/nami.svg' width={16} height={16} alt='Nami' /><span>Nami</span>
                    </div>
                  </td>
                  <td><div className='flex justify-center'><CheckIcon className='w-6 text-green-500' /></div></td>
                  <td><div className='flex justify-center'><XMarkIcon className='w-6 text-red-500' /></div></td>
                </tr>
                <tr>
                  <td>
                    <div className='flex items-center justify-center space-x-1 p-1'>
                      <Image src='/eternl.png' width={16} height={16} alt='Eternl' /><span>Eternl</span>
                    </div>
                  </td>
                  <td><div className='flex justify-center'><CheckIcon className='w-6 text-green-500' /></div></td>
                  <td><div className='flex justify-center'><CheckIcon className='w-6 text-green-500' /></div></td>
                </tr>
                <tr>
                  <td>
                    <div className='flex items-center justify-center space-x-1 p-1'>
                      <Image src='https://gerowallet.io/assets/img/logo2.ico' width={16} height={16} alt='Gero' /><span>Gero</span>
                    </div>
                  </td>
                  <td><div className='flex justify-center'><CheckIcon className='w-6 text-green-500' /></div></td>
                  <td><div className='flex justify-center'>Untested</div></td>
                </tr>
                <tr>
                  <td>
                    <div className='flex items-center justify-center space-x-1 p-1'>
                      <Image src={flintLogo} width={16} height={16} alt='Flint' /><span>Flint</span>
                    </div>
                  </td>
                  <td><div className='flex justify-center'><CheckIcon className='w-6 text-green-500' /></div></td>
                  <td><div className='flex justify-center'>Untested</div></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>We have an active and welcoming community. If you have any issues or questions, feel free to reach out to us via <a className='text-sky-700' target='_blank' rel='noreferrer' href='https://github.com/ADAOcommunity/round-table'>Github</a> or <a className='text-sky-700' target='_blank' rel='noreferrer' href='https://discord.gg/BGuhdBXQFU'>Discord</a>.</p>
        </Panel>
      </div>
    </Layout>
  )
}

export default Home
