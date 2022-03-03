import { NextPage } from "next";
import { ChangeEvent, useContext, useState } from "react";
import { ConfigContext } from "../cardano/config";
import Layout from '../components/layout'

const Configure: NextPage = () => {
  const [config, setConfig] = useContext(ConfigContext)
  const [isMainnet, setMainnet] = useState(config.isMainnet)
  const [queryAPI, setQueryAPI] = useState(config.queryAPI)

  const networkSwitch = (
    <div className='flex space-x-2'>
      <span>Mainnet</span>
      <label className='cursor-pointer'>
        <input
          type="checkbox"
          className='hidden appearance-none peer'
          checked={isMainnet}
          onChange={() => setMainnet(!isMainnet)} />
        <div className='flex flex-row-reverse rounded-full bg-gray-500 w-11 p-0.5 h-full peer-checked:flex-row peer-checked:bg-green-500'>
          <div className='bg-white basis-1/2 rounded-full'></div>
        </div>
      </label>
      <span>Testnet</span>
    </div>
  )

  const onQueryAPITypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const queryAPIType = event.target.value
    switch (queryAPIType) {
      case 'koios': return setQueryAPI({ type: 'koios' })
      case 'graphql': return setQueryAPI({type: 'graphql', URI: ''})
    }
  }

  const queryAPIConfig = (
    <div className='flex border rounded-sm overflow-hidden'>
      <select className='grow p-2' value={queryAPI.type} onChange={onQueryAPITypeChange}>
        <option value='koios'>Koios</option>
        <option value='graphql'>GraphQL</option>
      </select>
      {queryAPI.type == 'graphql' && (
        <input
          type='url'
          placeholder='URI'
          className='w-full p-1 outline-none'
          value={queryAPI.URI}
          onChange={(e) => setQueryAPI({ type: 'graphql', URI: e.target.value})}
        />
      )}
    </div>
  )

  return (
    <Layout>
      <div className='bg-white rounded-md md:mx-64 shadow text-gray-500 overflow-hidden'>
        <div className='p-4 space-y-2'>
          <div>
            {networkSwitch}
          </div>
          <div>
            <label>Query API</label>
            {queryAPIConfig}
          </div>
        </div>
        <footer className='py-2 px-4 bg-gray-100 flex flex-row-reverse'>
          <button
            className='p-2 rounded-md bg-blue-600 text-white'
            onClick={() => setConfig({ isMainnet, queryAPI })}
          >
            Apply
          </button>
        </footer>
      </div>
    </Layout>
  )
}

export default Configure
