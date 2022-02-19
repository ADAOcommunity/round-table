import { createContext, useContext } from 'react'

const NetworkContext = createContext<[boolean, (x: boolean) => void]>([true, (_: boolean) => { }])

const NetworkSwitch = () => {
  const [isMainnet, setMainnet] = useContext(NetworkContext)
  return (
    <div className='flex space-x-2 text-gray-500'>
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
}

export { NetworkContext, NetworkSwitch }
