import { NextPage } from 'next'
import { useContext, useEffect, useState } from 'react'
import { ConfigContext } from '../cardano/config'
import { estimateSlotByDate, getEpochBySlot, getSlotInEpochBySlot, SlotLength } from '../cardano/utils'

const ChainProgress: NextPage<{
  className?: string
}> = ({ className }) => {
  const baseClassName = 'relative h-6 rounded bg-gray-700 overflow-hidden'
  const [config, _] = useContext(ConfigContext)
  const { isMainnet } = config
  const [slot, setSlot] = useState<number>(estimateSlotByDate(new Date(), isMainnet))

  useEffect(() => {
    let isMounted = true

    const id = setInterval(() => {
      isMounted && setSlot(estimateSlotByDate(new Date(), isMainnet))
    }, 1000)

    return () => {
      clearInterval(id)
      isMounted = false
    }
  }, [config])

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

export { ChainProgress }
