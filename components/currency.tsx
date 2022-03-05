import { ChangeEvent, useContext } from "react"
import NumberFormat from "react-number-format"
import { Config, ConfigContext } from "../cardano/config"

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

const getADASymbol = (config: Config) => config.isMainnet ? '₳' : 't₳'

type AssetAmountProps = {
  quantity: bigint
  decimals: number
  symbol: string
  className?: string
}

const AssetAmount = ({quantity, decimals, symbol, className}: AssetAmountProps) => (
  <NumberFormat
    className={className}
    value={toDecimal(quantity, decimals)}
    decimalSeparator='.'
    isNumericString={true}
    thousandSeparator={false}
    allowNegative={false}
    decimalScale={decimals}
    suffix={` ${symbol}`}
    displayType='text' />
)

type ADAAmountProps = {
  lovelace: bigint
  className?: string
}

const ADAAmount = ({ lovelace, className }: ADAAmountProps) => {
  const [config, _] = useContext(ConfigContext)
  return <AssetAmount quantity={lovelace} decimals={6} symbol={getADASymbol(config)} className={className} />
}

export { getADASymbol, toDecimal, ADAAmount, AssetAmount, CurrencyInput }
