import { D, MAX_AMOUNT, formatDecimal } from "./decimal";
import { CURRENCY_PATTERN } from "./prices";
import type { Balances } from "./swap";

/** The demo wallet starts with 1 800 USD (same as the original Fancy Form). */
export const DEFAULT_BALANCES: Balances = Object.freeze({ USD: "1800" });

/**
 * Cleans balances read from untrusted storage (older versions stored values like `"1700.00"`; users can also
 * edit localStorage by hand). Invalid, zero, negative or oversized entries are dropped; values are normalised.
 * Returns `null` when nothing usable remains, so the caller can fall back to {@link DEFAULT_BALANCES}.
 */
export function sanitizeBalances(raw: unknown): Balances | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

  const clean = new Map<string, string>();
  for (const [currency, value] of Object.entries(raw)) {
    if (
      !CURRENCY_PATTERN.test(currency) ||
      (typeof value !== "string" && typeof value !== "number")
    ) {
      continue;
    }
    try {
      const amount = new D(typeof value === "number" ? String(value) : value.trim());
      const formatted = formatDecimal(amount);
      // Dust below the supported precision truncates to "0" and is dropped like any other empty balance.
      if (
        amount.isFinite() &&
        amount.lte(MAX_AMOUNT) &&
        formatted !== "0" &&
        !formatted.startsWith("-")
      ) {
        clean.set(currency, formatted);
      }
    } catch {
      // Not a number: ignore the entry.
    }
  }
  return clean.size === 0 ? null : Object.fromEntries(clean);
}
