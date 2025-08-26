type Blockchain = 'Osmosis' | 'Ethereum' | 'Arbitrum' | 'Zilliqa' | 'Neo'

interface WalletBalance {
  blockchain: Blockchain
  currency: string
  amount: number
}

interface FormattedWalletBalance extends WalletBalance {
  formatted: string
}

type PriceMap = Record<string, number>

interface Props extends BoxProps {}

const PRIORITY: Record<Blockchain, number> = {
  Osmosis: 100,
  Ethereum: 50,
  Arbitrum: 30,
  Zilliqa: 20,
  Neo: 20,
}

const getPriority = (b: Blockchain): number => PRIORITY[b] ?? -99

function WalletPage({ ...rest }: Props) {
  const balances = useWalletBalances() as WalletBalance[]
  const prices = usePrices() as PriceMap

  const sortedBalances = useMemo(() => {
    return balances
      .filter(b => getPriority(b.blockchain) > -99 && b.amount > 0)
      .slice()
      .sort((a, b) => {
        const pa = getPriority(a.blockchain)
        const pb = getPriority(b.blockchain)
        if (pa > pb) return -1
        if (pa < pb) return 1
        return 0
      })
  }, [balances])

  const formattedBalances = useMemo<FormattedWalletBalance[]>(
    () =>
      sortedBalances.map(b => ({
        ...b,
        formatted: b.amount.toFixed(2),
      })),
    [sortedBalances]
  )

  const rows = useMemo(
    () =>
      formattedBalances.map(b => {
        const usd = (prices[b.currency] ?? 0) * b.amount
        return (
          <WalletRow
            key={`${b.blockchain}-${b.currency}`}
            amount={b.amount}
            usdValue={usd}
            formattedAmount={b.formatted}
          />
        )
      }),
    [formattedBalances, prices]
  )

  return <div {...rest}>{rows}</div>
}
