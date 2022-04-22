import { NextPage } from 'next'
import { createContext, useContext, useEffect } from 'react'
import { ConfigContext } from '../cardano/config'
import { estimateSlotByDate, getEpochBySlot, getSlotInEpochBySlot, SlotLength } from '../cardano/utils'

const SystemTimeContext = createContext<[Date, (_: Date) => void]>([new Date(), (_: Date) => { }])

const ChainProgress: NextPage<{
  className?: string
}> = ({ className }) => {
  const baseClassName = 'relative h-6 rounded bg-gray-700 overflow-hidden'
  const [config, _] = useContext(ConfigContext)
  const [systemTime, setSystemTime] = useContext(SystemTimeContext)
  const { isMainnet } = config

  useEffect(() => {
    const id = setInterval(() => {
      setSystemTime(new Date())
    }, 1000)

    return () => {
      clearInterval(id)
    }
  }, [setSystemTime])

  const slot = estimateSlotByDate(systemTime, isMainnet)
  const slotInEpoch = getSlotInEpochBySlot(slot, isMainnet)
  const epoch = getEpochBySlot(slot, isMainnet)
  const progress = slotInEpoch / SlotLength * 100
  const style = progress && { width: `${progress}%` }

  return (
    <div className={className}>
      <div className={baseClassName}>
        {style && <div className='h-full bg-sky-700' style={style}></div>}
        <div className='absolute inset-0 text-center text-white'>
          {`Epoch ${epoch}: ${slotInEpoch}/${SlotLength} (${progress.toFixed(0)}%)`}
        </div>
      </div>
    </div>
  )
}

export { ChainProgress, SystemTimeContext }
