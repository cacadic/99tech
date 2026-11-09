import {
  AMOUNT_DECIMALS,
  D,
  MAX_AMOUNT,
  formatDecimal,
  parseAmount,
  type AmountIssue,
  type Dec,
} from "./decimal";
import type { PriceBook, PriceEntry } from "./prices";

/** Wallet balances: currency → plain decimal string (never exponent notation, never negative). */
export type Balances = Readonly<Record<string, string>>;

export interface SwapQuote {
  readonly from: string;
  readonly to: string;
  /** Amount the user sends. */
  readonly amount: Dec;
  /** Amount the user receives: `amount × price[from] / price[to]`, truncated to {@link AMOUNT_DECIMALS}. */
  readonly receive: Dec;
  /** Units of `to` per one unit of `from`: `price[from] / price[to]`. */
  readonly rate: Dec;
  readonly fromUsd: Dec;
  readonly toUsd: Dec;
}

/**
 * `receive = amount × price[from] / price[to]`.
 * Nothing is rounded before the final truncation to {@link AMOUNT_DECIMALS}, so the number shown in the
 * quote is exactly the number that gets credited to the wallet.
 */
export function quoteSwap(amount: Dec, from: PriceEntry, to: PriceEntry): SwapQuote {
  const receive = amount
    .mul(from.price)
    .div(to.price)
    .toDecimalPlaces(AMOUNT_DECIMALS, D.ROUND_DOWN);
  return {
    from: from.currency,
    to: to.currency,
    amount,
    receive,
    rate: from.price.div(to.price),
    fromUsd: amount.mul(from.price),
    toUsd: receive.mul(to.price),
  };
}

export type SwapIssueCode =
  | "prices_unavailable"
  | "token_from_missing"
  | "token_to_missing"
  | "same_token"
  | "price_missing_from"
  | "price_missing_to"
  | `amount_${AmountIssue}`
  | "insufficient_balance"
  | "receive_too_small"
  | "receive_too_large";

export type SwapField = "form" | "from" | "to" | "amount";

export interface SwapIssue {
  readonly code: SwapIssueCode;
  readonly field: SwapField;
  /** Values for the translated message (already formatted for display where relevant). */
  readonly params?: Readonly<Record<string, string>>;
}

export interface SwapInput {
  readonly amountText: string;
  readonly from: string | null;
  readonly to: string | null;
  /** `null` while prices are not available. */
  readonly prices: PriceBook | null;
  readonly balances: Balances;
}

export interface SwapValidation {
  readonly ok: boolean;
  readonly issues: readonly SwapIssue[];
  /** Present whenever a quote can be computed, even if the balance is too low (so the UI can preview it). */
  readonly quote: SwapQuote | null;
}

export function balanceOf(balances: Balances, currency: string): Dec {
  // `hasOwn`: a symbol such as "constructor" must not resolve to something inherited from Object.prototype.
  return Object.hasOwn(balances, currency) ? new D(balances[currency] ?? 0) : new D(0);
}

/**
 * Validates a swap request against prices and the wallet. Pure: the same checks run on every render
 * (to drive the UI) and again at commit time (see {@link applyMockSwap}).
 */
export function validateSwap(input: SwapInput): SwapValidation {
  const issues: SwapIssue[] = [];
  const { prices, balances, from, to } = input;

  if (prices === null) issues.push({ code: "prices_unavailable", field: "form" });
  if (from === null) issues.push({ code: "token_from_missing", field: "from" });
  if (to === null) issues.push({ code: "token_to_missing", field: "to" });
  if (from !== null && to !== null && from === to) {
    issues.push({ code: "same_token", field: "to", params: { symbol: to } });
  }

  const fromEntry = prices !== null && from !== null ? prices.get(from) : undefined;
  const toEntry = prices !== null && to !== null ? prices.get(to) : undefined;
  if (prices !== null && from !== null && fromEntry === undefined) {
    issues.push({ code: "price_missing_from", field: "from", params: { symbol: from } });
  }
  if (prices !== null && to !== null && toEntry === undefined) {
    issues.push({ code: "price_missing_to", field: "to", params: { symbol: to } });
  }

  const amount = parseAmount(input.amountText);
  if (!amount.ok) issues.push({ code: `amount_${amount.reason}`, field: "amount" });

  let quote: SwapQuote | null = null;
  if (amount.ok && fromEntry !== undefined && toEntry !== undefined && from !== to) {
    quote = quoteSwap(amount.value, fromEntry, toEntry);

    if (from !== null && amount.value.gt(balanceOf(balances, from))) {
      issues.push({
        code: "insufficient_balance",
        field: "amount",
        params: { symbol: from, balance: formatDecimal(balanceOf(balances, from)) },
      });
    }
    if (quote.receive.lte(0)) issues.push({ code: "receive_too_small", field: "amount" });
    if (to !== null && balanceOf(balances, to).plus(quote.receive).gt(MAX_AMOUNT)) {
      issues.push({ code: "receive_too_large", field: "amount" });
    }
  }

  return { ok: issues.length === 0, issues, quote };
}

export interface MockSwapRequest {
  readonly from: string;
  readonly to: string;
  readonly amount: Dec;
  readonly receive: Dec;
}

export type MockSwapResult =
  | { readonly ok: true; readonly balances: Balances }
  | {
      readonly ok: false;
      readonly code: "invalid_request" | "insufficient_balance" | "balance_limit";
    };

/**
 * Applies a simulated swap to a balances snapshot and returns the new snapshot — one atomic step:
 * either both sides change or nothing does. Balances are re-checked here, not only when the form rendered.
 * A zero balance is removed from the wallet.
 */
export function applyMockSwap(balances: Balances, request: MockSwapRequest): MockSwapResult {
  const { from, to, amount, receive } = request;
  if (from === to || amount.lte(0) || receive.lte(0)) return { ok: false, code: "invalid_request" };

  const available = balanceOf(balances, from);
  if (amount.gt(available)) return { ok: false, code: "insufficient_balance" };

  const credited = balanceOf(balances, to).plus(receive);
  if (credited.gt(MAX_AMOUNT)) return { ok: false, code: "balance_limit" };

  const next: Record<string, string> = { ...balances };
  const remaining = available.minus(amount);
  if (remaining.isZero()) {
    delete next[from];
  } else {
    next[from] = formatDecimal(remaining);
  }
  next[to] = formatDecimal(credited);
  return { ok: true, balances: next };
}

/**
 * The pair preselected on first render: USD → bNEO, as in the original Fancy Form. The sender prefers a token
 * the wallet actually holds (USD first), so the form never opens on something that cannot be spent.
 */
export function defaultPair(
  entries: readonly PriceEntry[],
  balances: Balances,
): { readonly from: string | null; readonly to: string | null } {
  const symbols = entries.map((entry) => entry.currency);
  const owned = symbols.filter((symbol) => balanceOf(balances, symbol).gt(0));
  const from = owned.includes("USD")
    ? "USD"
    : (owned[0] ?? (symbols.includes("USD") ? "USD" : (symbols[0] ?? null)));
  const to =
    from !== "bNEO" && symbols.includes("bNEO")
      ? "bNEO"
      : (symbols.find((s) => s !== from) ?? null);
  return { from, to };
}
