import { useMemo } from "react";
import { usePrices, useWalletBalances, WalletRow, type BoxProps } from "./context";
import { toRows } from "./wallet-utils";

export interface WalletPageProps extends BoxProps {
  /** Replaces the snippet's undefined `classes.row`. */
  rowClassName?: string;
}

export function WalletPage({ children, rowClassName, ...rest }: WalletPageProps) {
  const balances = useWalletBalances();
  const prices = usePrices();

  // The whole derivation is one pure function of exactly these two inputs, so the dependency
  // array is complete and nothing unused is listed (the original listed `prices` in a memo that
  // never read it, and left the rows, which do need prices, outside any memo).
  // Measured cost is tiny (see WhatWrong.md, "Why one useMemo"): this skips re-sorting and
  // re-formatting when the page re-renders for unrelated reasons, it is not a necessity.
  const rows = useMemo(() => toRows(balances, prices), [balances, prices]);

  return (
    <div {...rest}>
      {children}
      {rows.map((row) => (
        <WalletRow
          className={rowClassName}
          key={row.key}
          currency={row.currency}
          blockchain={row.blockchain}
          amount={row.amount}
          formattedAmount={row.formatted}
          usdValue={row.usdValue}
        />
      ))}
    </div>
  );
}

export default WalletPage;
