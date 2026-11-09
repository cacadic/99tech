import Decimal from "decimal.js";

/**
 * An isolated Decimal constructor: its configuration can never leak into (or be changed by) other code.
 * Rounding is always DOWN, so the app never credits more than the exchange rate justifies.
 */
export const D = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_DOWN,
  toExpNeg: -40,
  toExpPos: 40,
});
export type Dec = InstanceType<typeof D>;

/**
 * Amounts (wallet balances, user input, quotes) carry at most this many decimal places.
 * The price feed gives no per-token decimals, so this is a demo policy, not an on-chain precision.
 */
export const AMOUNT_DECIMALS = 8;

/**
 * Upper bound for a typed amount AND for any wallet balance (overflow guard). One number for both, so a balance
 * the wallet may hold can always be sent with Max, and nothing credited is later dropped on reload.
 */
export const MAX_AMOUNT = new D("1000000000000");

export type AmountIssue = "empty" | "malformed" | "not_positive" | "too_precise" | "too_large";

export type AmountParse = { ok: true; value: Dec } | { ok: false; reason: AmountIssue };

const PLAIN_NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
const NEGATIVE_NUMBER = /^-(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * Strictly parses user-typed amount text.
 *
 * Accepted:  `12`, `12.5`, `.5`, `5.`, `12,5` (a single comma is read as the decimal separator).
 * Rejected:  `""`, `1e5`, `NaN`, `Infinity`, `0x10`, `+5`, `1.2.3`, `1,000.5`, `abc`.
 * A value that is zero or negative reports `not_positive`.
 */
export function parseAmount(text: string): AmountParse {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };

  const normalized = /^[^.]*,[^.,]*$/.test(trimmed) ? trimmed.replace(",", ".") : trimmed;

  if (NEGATIVE_NUMBER.test(normalized)) return { ok: false, reason: "not_positive" };
  if (!PLAIN_NUMBER.test(normalized)) return { ok: false, reason: "malformed" };

  const value = new D(normalized.endsWith(".") ? normalized.slice(0, -1) : normalized);
  if (value.lte(0)) return { ok: false, reason: "not_positive" };
  if (value.decimalPlaces() > AMOUNT_DECIMALS) return { ok: false, reason: "too_precise" };
  if (value.gt(MAX_AMOUNT)) return { ok: false, reason: "too_large" };
  return { ok: true, value };
}

/** Plain-notation string, truncated (never rounded up) to `maxDecimals`, without trailing zeros. */
export function formatDecimal(value: Dec, maxDecimals: number = AMOUNT_DECIMALS): string {
  return value.toDecimalPlaces(maxDecimals, Decimal.ROUND_DOWN).toFixed();
}

/** Inserts thousands separators into the integer part of a plain-notation number string. */
export function groupThousands(plain: string): string {
  const negative = plain.startsWith("-");
  const [integer = "0", fraction] = (negative ? plain.slice(1) : plain).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}

/** Display form of a token quantity: `1,700.5`. */
export function formatAmount(value: Dec, maxDecimals: number = AMOUNT_DECIMALS): string {
  return groupThousands(formatDecimal(value, maxDecimals));
}

/** Display form of a USD value: `$99.93` (two decimals, half-up), `<$0.01` for non-zero dust. */
export function formatUsd(value: Dec): string {
  if (value.gt(0) && value.lt("0.005")) return "<$0.01";
  return `$${groupThousands(value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2))}`;
}

/** Exchange rate with up to 8 significant digits and no exponent: `0.14029234`. */
export function formatRate(rate: Dec): string {
  return groupThousands(rate.toSignificantDigits(8, Decimal.ROUND_HALF_UP).toFixed());
}
