import { ChangeEvent, KeyboardEvent, useState } from "react"
import NumberFormat from "react-number-format"

type Props = {
  value: bigint
  onChange: (_: bigint) => void
  decimals: number
  className?: string
  placeholder?: string
}

const toDecimal = (value: bigint, decimals: number): string => {
  const text = value.toString()
  if (decimals === 0) return text
  if (text.length > decimals) {
    return [text.slice(0, -decimals), text.slice(-decimals)].join('.')
  } else {
    return ['0', text.padStart(decimals, '0')].join('.')
  }
}

const CurrencyInput = ({ value, onChange, decimals, ...props }: Props) => {
  const inputValue = toDecimal(value, decimals)

  const changeHandle = (event: ChangeEvent<HTMLInputElement>) => {
    const [i, f] = event.target.value.split('.', 2)
    const number = BigInt(i + (f || '0').slice(0, decimals).padEnd(decimals, '0'))
    onChange(number)
  }

  return (
    <NumberFormat
      type='text'
      value={inputValue}
      decimalSeparator='.'
      displayType='input'
      thousandSeparator={false}
      allowNegative={false}
      decimalScale={decimals}
      fixedDecimalScale={true}
      onChange={changeHandle}
      {...props} />
  )
}

const toADA = (lovelace: bigint) => toDecimal(lovelace, 6)

export { toADA, toDecimal, CurrencyInput }
