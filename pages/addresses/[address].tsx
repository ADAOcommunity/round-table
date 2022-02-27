import { gql, ApolloClient, InMemoryCache } from '@apollo/client'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Config, ConfigContext } from '../../components/config'
import Layout from '../../components/layout'
import { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { toDecimal, CurrencyInput } from '../../components/currency-input'

const UTxOsQuery = gql`
query UTxOsByAddress($address: String!) {
  utxos(
    where: {
      address: {
        _eq: $address
      }
    }) {
    txHash
    index
    value
    tokens {
      asset {
        policyId
        assetName
      }
      quantity
    }
  }
}
`

type QueryData = {
  utxos: {
    txHash: string
    index: number
    value: string
    tokens: {
      asset: {
        policyId: string
        assetName: string
      }
      quantity: string
    }[]
  }[]
}

type QueryVars = {
  address: string
}

type AssetBalance = Map<string, bigint>

type TxOutput = {
  txHash: string
  index: number
}

type Balance = {
  lovelace: bigint
  assets: AssetBalance
}

type AddressBalance = { txOutputs: TxOutput[] } & Balance

type BalanceQuery = {
  loading: boolean
  error: boolean
  addressBalance?: AddressBalance
}

const useBalanceQuery = (address: string, config: Config): BalanceQuery => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [addressBalance, setAddressBalance] = useState<AddressBalance | undefined>(undefined)

  useEffect(() => {
    let isMounted = true

    const assets: AssetBalance = new Map()

    switch (config.queryAPI.type) {
      case 'graphql': {
        const apollo = new ApolloClient({
          uri: config.queryAPI.URI,
          cache: new InMemoryCache()
        })

        address && apollo.query<QueryData, QueryVars>({
          query: UTxOsQuery,
          variables: { address: address }
        }).then((result) => {
          const data = result.data
          const utxos = data && data.utxos

          utxos && utxos.forEach(({ tokens }) => {
            tokens.forEach(({ asset, quantity }) => {
              const { policyId, assetName } = asset
              const key = policyId + assetName
              const value = (assets.get(key) || BigInt(0)) + BigInt(quantity)
              assets.set(key, value)
            })
          })

          isMounted && utxos && setAddressBalance({
            txOutputs: utxos.map(({ txHash, index }) => { return { txHash, index } }),
            lovelace: utxos.map(({ value }) => BigInt(value)).reduce((acc, v) => acc + v, BigInt(0)),
            assets
          })

          isMounted && setLoading(false)
          isMounted && setError(false)
        }).catch(() => {
          isMounted && setError(true)
        })
      }

      case 'koios': {
        const host = config.isMainnet ? 'api.koios.rest' : 'testnet.koios.rest'
        const koios = axios.create({ baseURL: `https://${host}` })

        address && koios.get('/api/v0/address_info', { params: { _address: address } })
          .then(({ data }) => {
            type Info = {
              balance: string
              stake_address: string
              utxo_set: {
                tx_hash: string
                tx_index: number
                value: string
                asset_list: {
                  policy_id: string
                  asset_name: string
                  quantity: string
                }[]
              }[]
            }
            const json: Info[] = data
            const info = json[0]

            info && info.utxo_set.forEach(({ asset_list }) => {
              asset_list.forEach(({ policy_id, asset_name, quantity }) => {
                const key: string = policy_id + asset_name
                const value = (assets.get(key) || BigInt(0)) + BigInt(quantity)
                assets.set(key, value)
              })
            })

            isMounted && info && setAddressBalance({
              txOutputs: info.utxo_set.map(({ tx_hash, tx_index }) => {
                return { txHash: tx_hash, index: tx_index }
              }),
              lovelace: BigInt(info.balance),
              assets: assets
            })

            isMounted && setLoading(false)
            isMounted && setError(false)
          }).catch(() => {
            isMounted && setError(true)
          })
      }
    }

    return () => {
      isMounted = false
    }
  }, [address, config])

  return { loading, error, addressBalance }
}

const GetAddress: NextPage = () => {
  const router = useRouter()
  const { address } = router.query
  const [config, _] = useContext(ConfigContext)
  const { loading, error, addressBalance } = useBalanceQuery(address as string, config)

  type Recipient = { address: string } & Balance

  const defaultRecipient = {
    address: '',
    lovelace: BigInt(1e6),
    assets: new Map()
  }

  const [recipients, setRecipients] = useState<Recipient[]>([defaultRecipient])

  const getAssetName = (assetName: string): string => {
    const buffer = Buffer.from(assetName, 'hex')
    const decoder = new TextDecoder('ascii')
    return decoder.decode(buffer)
  }

  const toADA = (lovelace: bigint) => toDecimal(lovelace, 6)

  const Recipient = (recipient: Recipient, index: number, balance: Balance) => {
    const { address, lovelace, assets } = recipient
    const setRecipient = (newRecipient: Recipient) => {
      setRecipients(recipients.map((oldRecipient, _index) => {
        return _index === index ? newRecipient : oldRecipient
      }))
    }
    const setLovelace = (lovelace: bigint) => {
      setRecipient({ ...recipient, lovelace })
    }
    const setAsset = (id: string, quantity: bigint) => {
      setRecipient({
        address,
        lovelace,
        assets: new Map(assets).set(id, quantity)
      })
    }

    return (
      <div key={index} className='p-4 my-2 rounded-md bg-white space-y-2'>
        <label className='flex block border rounded-md overflow-hidden'>
          <span className='p-2 bg-gray-200'>TO</span>
          <input
            className='p-2 block w-full outline-none'
            value={address}
            onChange={(e) => setRecipient({ ...recipient, address: e.target.value })}
            placeholder='Address' />
        </label>
        <label className='flex block border rounded-md overflow-hidden'>
          <CurrencyInput
            className='p-2 block w-full outline-none'
            decimals={6}
            value={lovelace}
            onChange={setLovelace}
            placeholder='0.000000' />
          <button>of&nbsp;{toADA(balance.lovelace)}</button>
          <span className='p-2'>₳</span>
        </label>
        {Array.from(assets).map(([id, quantity]) => {
          const max = balance.assets.get(id)
          return (
            <label key={id} className='flex block border rounded-md overflow-hidden'>
              <CurrencyInput
                decimals={0}
                onChange={(value) => setAsset(id, value)}
                className='p-2 block w-full outline-none'
                value={quantity}
              />
              {max && <button>of&nbsp;{toDecimal(max, 0)}</button>}
              <span className='p-2'>{getAssetName(id.slice(56))}</span>
            </label>
          )
        })}
        <div className='relative'>
          <button className='block rounded-md bg-gray-200 p-2 peer'>Add Asset</button>
          <ul className='absolute mt-1 divide-y bg-white text-sm max-h-64 rounded-md shadow overflow-y-scroll invisible peer-focus:visible hover:visible'>
            {Array.from(balance.assets)
              .filter(([id, _]) => !assets.has(id))
              .map(([id, quantity]) => (
                <li key={id}>
                  <button
                    onClick={() => setAsset(id, BigInt(0))}
                    className='block w-full h-full px-1 py-2 hover:bg-slate-100'
                  >
                    <div className='flex space-x-2'>
                      <span>{getAssetName(id.slice(56))}</span>
                      <span className='grow text-right'>{quantity.toString()}</span>
                    </div>
                    <div className='flex space-x-1'>
                      <span className='font-mono text-gray-500 text-xs'>{id.slice(0, 56)}</span>
                    </div>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>
    )
  }

  if (error) return <div>An error happened.</div>

  if (loading) return (
    <div className='text-center'>
      Loading...
    </div>
  )

  if (addressBalance) {
    const balance = addressBalance

    return (
      <Layout>
        <div className='p-4 rounded-md bg-white my-2'>
          <h1 className='font-medium text-center'>{address}</h1>
          <h2 className='font-medium text-center text-lg'>{toADA(addressBalance.lovelace)}&nbsp;₳</h2>
        </div>
        {recipients.map((recipient, index) => Recipient(recipient, index, balance))}
        <div className='p-4 rounded-md bg-white my-2'>
          <button
            className='p-2 rounded-md bg-gray-200'
            onClick={() => setRecipients(recipients.concat(defaultRecipient))}
          >
            Add Recipient
          </button>
        </div>
      </Layout>
    )
  } else {
    return <div>No content</div>
  }
}

export default GetAddress
