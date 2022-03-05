import { NextPage } from "next";
import Layout from '../components/layout'
import { CogIcon } from '@heroicons/react/solid'
import { useContext } from "react";
import { ConfigContext } from "../cardano/config";

const Configure: NextPage = () => {
  const [config, _] = useContext(ConfigContext)

  return (
    <Layout>
      <div className='bg-white rounded-md md:mx-64 shadow overflow-hidden'>
        <header className='flex p-4 bg-gray-100 font-bold items-center space-x-1'>
          <span><CogIcon className='h-4 w-4' /></span>
          <h1>Configuration</h1>
        </header>
        <div className='p-4 space-y-2'>
          <p className='space-x-2'>
            <span>Network:</span>
            <span>{config.isMainnet ? 'Mainnet' : 'Testnet'}</span>
          </p>
          <p className='space-x-2'>
            <span>Query API:</span>
            <span>{config.queryAPI.type}</span>
          </p>
          {config.queryAPI.type == 'graphql' &&
            <p className='space-x-2'>
              <span>Query URI:</span>
              <span>{config.queryAPI.URI}</span>
            </p>
          }
        </div>
      </div>
    </Layout>
  )
}

export default Configure
