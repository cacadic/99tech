import type { Blockchain, PriceMap, WalletBalance, WalletRowData } from "./types";

/** Returned for every blockchain that is not in the table (same value as the original). */
export const UNKNOWN_PRIORITY = -99;

/** Shown instead of a number that cannot be computed (no price, NaN, ...). */
export const PLACEHOLDER = "—";

// A Map, not an object literal: `PRIORITY["constructor"]` on a plain object would find
// Object.prototype members and return a function instead of "unknown".
const PRIORITY: ReadonlyMap<string, number> = new Map<Blockchain, number>([
  ["Osmosis", 100],
  ["Ethereum", 50],
  ["Arbitrum", 30],
  ["Zilliqa", 20],
  ["Neo", 20],
]);

export function getPriority(blockchain: string): number {
  return PRIORITY.get(blockchain) ?? UNKNOWN_PRIORITY;
}

export function isKnownBlockchain(blockchain: string): blockchain is Blockchain {
  return PRIORITY.has(blockchain);
}

/**
 * What the original filter meant to keep: a balance on a known chain that actually holds
 * something. `Number.isFinite` rejects NaN and +-Infinity, which `amount > 0` alone lets
 * through (Infinity > 0 is true).
 */
export function isDisplayable(balance: WalletBalance): boolean {
  return isKnownBlockchain(balance.blockchain) && Number.isFinite(balance.amount) && balance.amount > 0;
}

function compareText(a: string, b: string): number {
  // Code-unit order on purpose: localeCompare would depend on the runtime's locale.
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Priority descending, then a deterministic tie-break chain. Zilliqa and Neo share priority 20,
 * so without the tie-break their relative order would be whatever order the data source happened
 * to return. Always returns a number (the original comparator returned `undefined` on ties).
 */
export function compareBalances(a: WalletBalance, b: WalletBalance): number {
  return (
    getPriority(b.blockchain) - getPriority(a.blockchain) ||
    compareText(a.currency, b.currency) ||
    compareText(a.blockchain, b.blockchain) ||
    // Only reachable for exact duplicates; keeps the output independent of input order.
    b.amount - a.amount
  );
}

// Intl.NumberFormat construction is expensive; build once, not once per row per render.
const MAX_FRACTION_DIGITS = 8;
const amountFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: MAX_FRACTION_DIGITS });
const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const SMALLEST_SHOWN = 10 ** -MAX_FRACTION_DIGITS;

/**
 * Token amount for display. Replaces `amount.toFixed()`, which rounds to an integer
 * ((0.000001234).toFixed() === "0", (2.5).toFixed() === "3") and prints "NaN"/"Infinity"/"1e+21".
 */
export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return PLACEHOLDER;
  // Never display a positive balance as "0".
  if (amount > 0 && amount < SMALLEST_SHOWN) return `<${amountFormat.format(SMALLEST_SHOWN)}`;
  // `+ 0` turns -0 into 0 (Intl would print "-0").
  return amountFormat.format(amount + 0);
}

export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return PLACEHOLDER;
  return usdFormat.format(value + 0);
}

/**
 * USD value of a balance, or `null` when it cannot be known. The original multiplied blindly:
 * a currency missing from `prices` gave `undefined * amount === NaN`. A price of 0 is treated as
 * "unknown" as well, since a feed that has not loaded yet is far likelier than a worthless token.
 */
export function usdValue(balance: WalletBalance, prices: PriceMap): number | null {
  if (!Object.hasOwn(prices, balance.currency)) return null;
  const price = prices[balance.currency];
  if (price === undefined || !Number.isFinite(price) || price <= 0) return null;
  const value = price * balance.amount;
  return Number.isFinite(value) ? value : null;
}

/** filter -> sort -> format -> value, as one pure function. Does not mutate its inputs. */
export function toRows(balances: readonly WalletBalance[], prices: PriceMap): WalletRowData[] {
  const seen = new Map<string, number>();
  return balances
    .filter(isDisplayable)
    .sort(compareBalances) // sorts the array filter() just created, never `balances`
    .map((balance) => {
      const base = rowKey(balance);
      const occurrence = (seen.get(base) ?? 0) + 1;
      seen.set(base, occurrence);
      return {
        ...balance,
        key: occurrence === 1 ? base : `${base}#${occurrence}`,
        formatted: formatAmount(balance.amount),
        usdValue: usdValue(balance, prices),
      };
    });
}

export function rowKey(balance: Pick<WalletBalance, "blockchain" | "currency">): string {
  return `${balance.blockchain}:${balance.currency}`;
}
