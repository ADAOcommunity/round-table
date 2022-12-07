import type { FC } from 'react'
import { ChangeEventHandler, useContext } from "react"
import NumberFormat from "react-number-format"
import { ConfigContext, isMainnet } from "../cardano/config"
import type { Config } from "../cardano/config"

const toDecimal = (value: bigint, decimals: number): string => {
  const text = value.toString()
  if (decimals === 0) return text
  if (text.length > decimals) {
    return [text.slice(0, -decimals), text.slice(-decimals)].join('.')
  } else {
    return ['0', text.padStart(decimals, '0')].join('.')
  }
}

const removeTrailingZero = (value: string): string =>
  value
    .replace(/(\.[0-9]*[1-9]+)0*$/, '$1')
    .replace(/\.0+$/, '')

const CurrencyInput: FC<{
  disabled?: boolean
  value: bigint
  onChange: (_: bigint) => void
  decimals: number
  className?: string
  placeholder?: string
}> = ({ disabled, value, onChange, decimals, ...props }) => {
  const inputValue = toDecimal(value, decimals)

  const changeHandle: ChangeEventHandler<HTMLInputElement> = (event) => {
    const [i, f] = event.target.value.split('.', 2)
    const number = BigInt(i + (f || '0').slice(0, decimals).padEnd(decimals, '0'))
    onChange(number)
  }

  return (
    <NumberFormat
      type='text'
      value={inputValue}
      decimalSeparator='.'
      isNumericString={true}
      displayType='input'
      thousandSeparator={false}
      allowNegative={false}
      decimalScale={decimals}
      fixedDecimalScale={true}
      onChange={changeHandle}
      disabled={disabled}
      {...props} />
  )
}

const getADASymbol = (config: Config) => isMainnet(config) ? '₳' : 't₳'

const AssetAmount: FC<{
  quantity: bigint
  decimals: number
  symbol: string
  className?: string
}> = ({ quantity, decimals, symbol, className }) => {
  const value = removeTrailingZero(toDecimal(quantity, decimals))
  return (
    <span className={className}>{`${value} ${symbol}`}</span>
  )
}

const ADAAmount: FC<{
  lovelace: bigint
  className?: string
}> = ({ lovelace, className }) => {
  const [config, _] = useContext(ConfigContext)
  return <AssetAmount quantity={lovelace} decimals={6} symbol={getADASymbol(config)} className={className} />
}

const LabeledCurrencyInput: FC<{
  symbol: string
  decimal: number
  value: bigint
  min?: bigint
  max: bigint
  maxButton?: boolean
  onChange: (_: bigint) => void
  placeholder?: string
}> = (props) => {
  const { decimal, value, onChange, min, max, maxButton, symbol, placeholder } = props
  const changeHandle = (value: bigint) => {
    const min = value > max ? max : value
    onChange(min)
  }
  const isValid = value > 0 && value <= max && (min ? value >= min : true)

  return (
    <label className='flex grow border rounded overflow-hidden'>
      <CurrencyInput
        className={['p-2 block w-full outline-none', isValid ? '' : 'text-red-500'].join(' ')}
        decimals={decimal}
        value={value}
        onChange={changeHandle}
        placeholder={placeholder} />
      <div className='p-2 space-x-1'>
        <span>of</span>
        <span>{toDecimal(max, decimal)}</span>
        <span>{symbol}</span>
      </div>
      {maxButton &&
        <button
          onClick={() => onChange(max)}
          className='bg-gray-100 border-l py-2 px-4 group text-sky-700'>
          Max
        </button>
      }
    </label>
  )
}

const ADAInput: FC<{
  className?: string
  disabled?: boolean
  lovelace: bigint
  setLovelace: (_: bigint) => void
}> = ({ className, disabled, lovelace, setLovelace }) => {
  return (
    <CurrencyInput className={className} value={lovelace} onChange={setLovelace} decimals={6} disabled={disabled} />
  )
}

export { getADASymbol, removeTrailingZero, toDecimal, ADAAmount, ADAInput, AssetAmount, CurrencyInput, LabeledCurrencyInput }
