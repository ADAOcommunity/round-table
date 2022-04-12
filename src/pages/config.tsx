import { NextPage } from "next";
import { Layout, Panel } from '../components/layout'
import { useContext } from "react";
import { ConfigContext } from "../cardano/config";
import { ExportUserDataButton, ImportUserData } from '../components/user-data'

const Configure: NextPage = () => {
  const [config, _] = useContext(ConfigContext)

  return (
    <Layout>
      <Panel className='p-4 space-y-2'>
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
        <p className='space-x-2'>
          <span>Submit API:</span>
          <span>{config.submitAPI}</span>
        </p>
        {config.gunPeers && <div>
          <span>GUN Peers:</span>
          <ul>
            {config.gunPeers.map((peer, index) => <li key={index}>{peer}</li>)}
          </ul>
        </div>}
        <div className='font-semibold'>User Data Export/Import</div>
        <p>User data has to be on the same network. For example, data exported from testnet cannot be imported to mainnet.</p>
        <p>Save my treasuries</p>
        <div className='flex'>
          <ExportUserDataButton />
        </div>
        <p>Load my treasuries</p>
        <div className='flex'>
          <ImportUserData />
        </div>
      </Panel>
    </Layout>
  )
}

export default Configure
