import { gql, ApolloClient, InMemoryCache } from '@apollo/client'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { Config, ConfigContext } from '../../components/config'
import Layout from '../../components/layout'
import { useContext, useEffect, useState } from 'react'
import axios from 'axios'

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
  txOutputs: TxOutput[]
  lovelace: bigint
  assets: AssetBalance
}

type BalanceQuery = {
  loading: boolean
  error: boolean
  balance?: Balance
}

const useBalanceQuery = (address: string, config: Config): BalanceQuery => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [balance, setBalance] = useState<Balance | undefined>(undefined)

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

          isMounted && utxos && setBalance({
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

            isMounted && info && setBalance({
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

  return { loading, error, balance }
}

const GetAddress: NextPage = () => {
  const router = useRouter()
  const { address } = router.query
  const [config, _] = useContext(ConfigContext)
  const { loading, error, balance } = useBalanceQuery(address as string, config)
  type AssetInput = {
    id: string,
    quantity: bigint
    max: bigint
  }
  const [lovelaceInput, setLovelaceInput] = useState(BigInt(0))
  const [assetInputs, setAssetInputs] = useState<AssetInput[]>([])

  if (loading) return (
    <div className='text-center'>
      Loading...
    </div>
  )

  if (error) return <div>An error happened.</div>

  const toPrecision = (value: bigint, decimals: number): string => {
    const text = value.toString()
    if (text.length > decimals) {
      return [text.slice(0, -decimals), text.slice(-decimals)].join('.')
    } else {
      return ['0', text.padStart(decimals, '0')].join('.')
    }
  }

  const getAssetName = (assetName: string): string => {
    const buffer = Buffer.from(assetName, 'hex')
    const decoder = new TextDecoder('ascii')
    return decoder.decode(buffer)
  }

  const setAssetInput = (newAssetInput: AssetInput) => {
    setAssetInputs(assetInputs.map((oldAssetInput) => {
      return oldAssetInput.id === newAssetInput.id ? newAssetInput : oldAssetInput
    }))
  }

  if (balance) {
    return (
      <Layout>
        <div className='p-4 rounded-md bg-white'>
          <h1 className='font-medium text-center'>{address}</h1>
          <h2 className='font-medium text-center text-lg'>{toPrecision(balance.lovelace, 6)}&nbsp;₳</h2>
          <div className='space-y-2'>
            <label className='flex block border rounded-md overflow-hidden'>
              <span className='p-2 bg-gray-200'>TO</span>
              <input className='p-2 block w-full outline-none' placeholder='Address' />
            </label>
            <label className='flex block border rounded-md overflow-hidden'>
              <span className='p-2 bg-gray-200'>Lovelace</span>
              <input
                className='p-2 block w-full outline-none'
                type='number'
                value={lovelaceInput.toString()}
                min={1}
                max={balance.lovelace.toString()}
                onChange={(e) => setLovelaceInput(BigInt(e.target.value))}
                placeholder='0.000000' />
              <button className='p-2 bg-gray-200'>Max:&nbsp;{balance.lovelace.toString()}</button>
            </label>
            {assetInputs.map(({ id, quantity, max }) => (
              <label key={id} className='flex block border rounded-md overflow-hidden'>
                <span className='p-2 bg-gray-200'>{getAssetName(id.slice(56))}</span>
                <input
                  onChange={(e) => setAssetInput({ id, max, quantity: BigInt(e.target.value) })}
                  className='p-2 block w-full outline-none'
                  type="number"
                  step={1}
                  min={1}
                  max={max.toString()}
                  value={quantity.toString()}
                />
                <button className='p-2 bg-gray-200'>Max:&nbsp;{max.toString()}</button>
              </label>
            ))}
            <div className='relative'>
              <button className='block rounded-md bg-gray-200 p-2 peer'>Add Asset</button>
              <ul className='absolute mt-1 divide-y bg-white text-sm max-h-64 rounded-md shadow overflow-y-scroll invisible peer-focus:visible hover:visible'>
                {Array.from(balance.assets)
                  .filter(([id, _]) => !assetInputs.find((asset) => asset.id === id))
                  .map(([id, quantity]) => (
                    <li key={id}>
                      <button
                        onClick={() => setAssetInputs(assetInputs.concat({ id, max: quantity, quantity }))}
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
        </div>
      </Layout>
    )
  } else {
    return <div>No content</div>
  }
}

export default GetAddress
