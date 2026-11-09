import { z } from "zod";
import { D, type Dec } from "./decimal";

/**
 * One tradable token with its reference price. The feed publishes a single unit for all prices
 * (USD in practice), which is what makes `rate(from → to) = price[from] / price[to]` valid.
 */
export interface PriceEntry {
  readonly currency: string;
  readonly price: Dec;
  /** ISO-8601 timestamp of the record that was selected. */
  readonly date: string;
  /** `Date.parse(date)`, kept so ordering never re-parses strings. */
  readonly timestamp: number;
}

export type PriceBook = ReadonlyMap<string, PriceEntry>;

export type SkipReason = "not_an_object" | "invalid_currency" | "invalid_price" | "invalid_date";

export interface SkippedRecord {
  readonly index: number;
  readonly reason: SkipReason;
}

export interface NormalizedPrices {
  /** One entry per currency, in order of first appearance in the feed. */
  readonly entries: readonly PriceEntry[];
  readonly book: PriceBook;
  /** Records that were ignored, with the reason; never silently repaired. */
  readonly skipped: readonly SkippedRecord[];
  /** Newest timestamp among the selected entries (ISO), or null when there are none. */
  readonly asOf: string | null;
}

/**
 * Symbols are untrusted and double as object keys in the wallet, so they must start with a letter or digit
 * (this rules out `__proto__`) and use a small safe alphabet.
 */
export const CURRENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const CURRENCY = CURRENCY_PATTERN;
// ISO-8601: a date, or a date-time that carries an explicit offset (a zone-less time is ambiguous).
const ISO_8601 =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-](\d{2}):(\d{2})))?$/;

/**
 * ISO-8601 shape AND a date that exists. `Date.parse` is lenient: it turns 2021-02-30 into 2 March and
 * T24:00 into the next day, which would let a bogus record look newer than a genuine one.
 */
export function isRealIsoDate(value: string): boolean {
  const match = ISO_8601.exec(value);
  if (match === null) return false;
  const part = (index: number): number => Number(match[index] ?? 0);
  const [year, month, day] = [part(1), part(2), part(3)];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day &&
    part(4) <= 23 &&
    part(5) <= 59 &&
    part(6) <= 59 &&
    part(7) <= 23 &&
    part(8) <= 59
  );
}

const RecordSchema = z.object({
  currency: z.string().regex(CURRENCY),
  date: z.string().refine(isRealIsoDate),
  price: z.number().finite().positive(),
});

function skipReason(raw: unknown): SkipReason {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return "not_an_object";
  const record = raw as Record<string, unknown>;
  if (typeof record.currency !== "string" || !CURRENCY.test(record.currency)) {
    return "invalid_currency";
  }
  if (typeof record.price !== "number" || !Number.isFinite(record.price) || record.price <= 0) {
    return "invalid_price";
  }
  return "invalid_date";
}

/**
 * Turns an untrusted JSON payload into a price book.
 *
 * Rules (each one covered by a test):
 * - A record is kept only if `currency`, `price` and `date` are all valid; anything else is skipped and reported.
 *   A record without a trustworthy timestamp is never used: `date` is not guessed.
 * - When a currency has several valid records, the one with the **newest timestamp** wins.
 *   Equal timestamps are broken deterministically: the record that appears **later in the feed** wins.
 * - Tokens that end up without a valid record are simply absent (and therefore not swappable).
 */
export function normalizePriceData(raw: unknown): NormalizedPrices {
  const skipped: SkippedRecord[] = [];
  const winners = new Map<string, PriceEntry>();
  const order: string[] = [];

  if (Array.isArray(raw)) {
    raw.forEach((item: unknown, index) => {
      const parsed = RecordSchema.safeParse(item);
      const timestamp = parsed.success ? Date.parse(parsed.data.date) : Number.NaN;
      if (!parsed.success || Number.isNaN(timestamp)) {
        skipped.push({ index, reason: parsed.success ? "invalid_date" : skipReason(item) });
        return;
      }

      const { currency, date, price } = parsed.data;
      const current = winners.get(currency);
      if (current === undefined) order.push(currency);
      if (current === undefined || timestamp >= current.timestamp) {
        winners.set(currency, { currency, date, timestamp, price: new D(String(price)) });
      }
    });
  }

  const entries = order.flatMap((currency) => {
    const entry = winners.get(currency);
    return entry === undefined ? [] : [entry];
  });
  const newest = entries.reduce<PriceEntry | null>(
    (best, entry) => (best === null || entry.timestamp > best.timestamp ? entry : best),
    null,
  );

  return {
    entries,
    book: new Map(entries.map((e) => [e.currency, e])),
    skipped,
    asOf: newest?.date ?? null,
  };
}
