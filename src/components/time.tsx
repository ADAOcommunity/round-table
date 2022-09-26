import type { FC } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ConfigContext } from '../cardano/config'
import { estimateSlotByDate, getEpochBySlot, getSlotInEpochBySlot, SlotLength } from '../cardano/utils'
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'

const DateContext = createContext<[Date, (_: Date) => void]>([new Date(), (_: Date) => { }])

const ChainProgress: FC<{
  className?: string
}> = ({ className }) => {
  const baseClassName = 'relative h-6 rounded bg-gray-700 overflow-hidden'
  const [config, _] = useContext(ConfigContext)
  const [_date, setDate] = useContext(DateContext)
  const [text, setText] = useState('')
  const [style, setStyle] = useState<{ width: string }>({ width: '0' })
  const { isMainnet } = config

  useEffect(() => {
    const id = setInterval(() => {
      const date = new Date()
      const slot = estimateSlotByDate(date, isMainnet)
      const slotInEpoch = getSlotInEpochBySlot(slot, isMainnet)
      const epoch = getEpochBySlot(slot, isMainnet)
      const progress = slotInEpoch / SlotLength * 100

      setStyle({ width: `${progress}%` })
      setText(`Epoch ${epoch}: ${slotInEpoch}/${SlotLength} (${progress.toFixed(0)}%)`)
      setDate(date)
    }, 1000)

    return () => {
      clearInterval(id)
    }
  }, [setDate, isMainnet])

  return (
    <div className={className}>
      <div className={baseClassName}>
        {style && <div className='h-full bg-sky-700' style={style}></div>}
        <div className='absolute inset-0 text-center text-white'>
          {text}
        </div>
      </div>
    </div>
  )
}

function monthIter(year: number, month: number): IterableIterator<Date> {
  let day = 1
  return {
    next: () => {
      const value = new Date(year, month, day++)
      if (value.getMonth() === month) return { done: false, value }
      return { done: true, value: null }
    },
    [Symbol.iterator]: function() { return this }
  }
}

const Calendar: FC<{
  selectedDate: Date
  onChange: (_: Date) => void
  isRed: (_: Date) => boolean
}> = ({ selectedDate, onChange, isRed }) => {
  const [date, setDate] = useState<Date>(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  const year = date.getFullYear()
  const month = date.getMonth()
  const weeks: Date[][] = useMemo(() => {
    const result: Date[][] = new Array([])
    Array
      .from(monthIter(year, month))
      .forEach((date) => {
        const day = date.getDay()
        if (day === 0) {
          result.push([date])
          return
        }
        result[result.length - 1][day] = date
      })
    return result
  }, [year, month])
  const isOnSelectedDate = (date: Date): boolean =>
    date.getFullYear() === selectedDate.getFullYear() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getDate() === selectedDate.getDate()

  return (
    <div className='flex border rounded'>
      <div>
        <nav className='flex py-2 justify-center space-x-8'>
          <div className='flex space-x-4 text-sky-700'>
            <button onClick={() => setDate(new Date(year - 1, month, 1))} className='p-1'><ChevronDoubleLeftIcon className='w-4' /></button>
            <button onClick={() => setDate(new Date(year, month - 1, 1))} className='p-1'><ChevronLeftIcon className='w-4' /></button>
          </div>
          <div className='space-x-2 font-semibold'>
            <span>{date.toLocaleString('default', { month: 'long' })}</span>
            <span>{year}</span>
          </div>
          <div className='flex space-x-4 text-sky-700'>
            <button onClick={() => setDate(new Date(year, month + 1, 1))} className='p-1'><ChevronRightIcon className='w-4' /></button>
            <button onClick={() => setDate(new Date(year + 1, month, 1))} className='p-1'><ChevronDoubleRightIcon className='w-4' /></button>
          </div>
        </nav>
        <table className='w-full table-fixed'>
          <thead>
            <tr>
              <th className='font-semibold'>Sun</th>
              <th className='font-semibold'>Mon</th>
              <th className='font-semibold'>Tue</th>
              <th className='font-semibold'>Wed</th>
              <th className='font-semibold'>Thu</th>
              <th className='font-semibold'>Fri</th>
              <th className='font-semibold'>Sat</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((dates, index) => <tr key={index}>
              {Array.from({ length: 7 }, (_, i) => i).map((day) => {
                const date = dates[day]
                if (!date) return (
                  <td key={day}></td>
                )
                const tdClassName = isRed(date) ? 'bg-red-100 text-red-700' : ''
                let buttonClassName = 'block w-full p-2 rounded hover:text-white '
                if (isRed(date)) {
                  buttonClassName = buttonClassName + 'hover:bg-red-700 '
                } else {
                  buttonClassName = buttonClassName + 'text-sky-700 hover:bg-sky-700 '
                }
                if (isOnSelectedDate(date)) {
                  buttonClassName = buttonClassName + 'text-white ' + (isRed(date) ? 'bg-red-700' : 'bg-sky-700')
                }
                return (
                  <td key={day} className={tdClassName}>
                    <button className={buttonClassName} onClick={() => onChange(date)}>{date.getDate()}</button>
                  </td>
                )
              })}
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export { ChainProgress, Calendar, DateContext }
