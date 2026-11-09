/**
 * Stand-ins for everything the challenge snippet uses but never defines, so the refactor
 * compiles and can be tested. They are ASSUMPTIONS, not the real implementations:
 *
 * - BoxProps          -> plain <div> attributes (the snippet spreads `rest` onto a <div>).
 * - useWalletBalances -> reads WalletBalance[] from a React context (empty by default).
 * - usePrices         -> reads a PriceMap from the same context (empty by default).
 * - WalletRow         -> a small presentational row; takes the same props as in the snippet, plus
 *                        `currency` / `blockchain` labels, and a nullable `usdValue`.
 *
 * The real app would replace this file; solution.tsx only depends on these names and shapes.
 */
import { createContext, useContext, type HTMLAttributes, type ReactNode } from "react";
import type { PriceMap, WalletBalance } from "./types";
import { formatUsd } from "./wallet-utils";

export type BoxProps = HTMLAttributes<HTMLDivElement>;

interface WalletData {
  balances: readonly WalletBalance[];
  prices: PriceMap;
}

const EMPTY: WalletData = { balances: [], prices: {} };

const WalletDataContext = createContext<WalletData>(EMPTY);

export interface WalletDataProviderProps extends WalletData {
  children: ReactNode;
}

export function WalletDataProvider({ balances, prices, children }: WalletDataProviderProps) {
  return <WalletDataContext value={{ balances, prices }}>{children}</WalletDataContext>;
}

export function useWalletBalances(): readonly WalletBalance[] {
  return useContext(WalletDataContext).balances;
}

export function usePrices(): PriceMap {
  return useContext(WalletDataContext).prices;
}

export interface WalletRowProps {
  className?: string;
  currency: string;
  blockchain: string;
  amount: number;
  formattedAmount: string;
  /** `null` = no usable price; the row shows a placeholder instead of "NaN". */
  usdValue: number | null;
}

export function WalletRow({ className, currency, blockchain, amount, formattedAmount, usdValue }: WalletRowProps) {
  return (
    <div className={className} data-testid="wallet-row" data-amount={amount}>
      <span data-field="currency">{currency}</span>
      <span data-field="blockchain">{blockchain}</span>
      <span data-field="amount">{formattedAmount}</span>
      <span data-field="usd">{formatUsd(usdValue)}</span>
    </div>
  );
}
