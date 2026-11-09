/** Blockchains the wallet page knows how to rank. */
export type Blockchain = "Osmosis" | "Ethereum" | "Arbitrum" | "Zilliqa" | "Neo";

/**
 * The original interface had no `blockchain` field, yet the code read `balance.blockchain`.
 *
 * It is typed `string`, not `Blockchain`, on purpose: balances come from an external hook, so
 * the page must survive chains it has never heard of (the original `default: return -99`
 * branch exists for exactly that). `isKnownBlockchain` narrows when it matters.
 */
export interface WalletBalance {
  blockchain: string;
  currency: string;
  amount: number;
}

export interface FormattedWalletBalance extends WalletBalance {
  formatted: string;
}

/** currency -> USD price of one unit. */
export type PriceMap = Record<string, number>;

/** One fully derived table row: everything the view needs, nothing it must compute. */
export interface WalletRowData extends FormattedWalletBalance {
  /** Unique and stable for a given balance: `blockchain:currency` (+ `#n` for exact duplicates). */
  key: string;
  /** `amount * price`, or `null` when there is no usable price. Never NaN. */
  usdValue: number | null;
}
