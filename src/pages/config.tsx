import { NextPage } from "next";
import { Layout, Panel } from '../components/layout'
import { useContext } from "react";
import { ConfigContext } from "../cardano/config";

const Configure: NextPage = () => {
  const [config, _] = useContext(ConfigContext)

  return (
    <Layout>
      <Panel>
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
          {config.gunPeers && <div>
            <span>GUN Peers:</span>
            <ul>
              {config.gunPeers.map((peer, index) => <li key={index}>{peer}</li>)}
            </ul>
          </div>}
        </div>
      </Panel>
    </Layout>
  )
}

export default Configure
