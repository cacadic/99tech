import { describe, expect, it } from "vitest";
import { SAMPLE_PRICE_RECORDS } from "@/shared/constants/samplePrices";
import { D, MAX_AMOUNT, formatDecimal, parseAmount } from "./decimal";
import { normalizePriceData, type PriceBook } from "./prices";
import { sanitizeBalances } from "./wallet";
import {
  applyMockSwap,
  balanceOf,
  defaultPair,
  quoteSwap,
  validateSwap,
  type Balances,
  type SwapInput,
} from "./swap";

const feed = (...pairs: [string, number][]): PriceBook =>
  normalizePriceData(
    pairs.map(([currency, price]) => ({ currency, price, date: "2023-01-01T00:00:00Z" })),
  ).book;

const entry = (book: PriceBook, symbol: string) => {
  const found = book.get(symbol);
  if (!found) throw new Error(`no price for ${symbol}`);
  return found;
};

const live = normalizePriceData(SAMPLE_PRICE_RECORDS).book;

describe("quoteSwap", () => {
  const book = feed(["A", 2], ["B", 4]);

  it("sending 3 A (2 USD) for B (4 USD) yields exactly 1.5 B", () => {
    const quote = quoteSwap(new D(3), entry(book, "A"), entry(book, "B"));
    expect(quote.receive.toFixed()).toBe("1.5");
    expect(quote.rate.toFixed()).toBe("0.5");
    expect(quote.fromUsd.toFixed()).toBe("6");
    expect(quote.toUsd.toFixed()).toBe("6");
  });

  it("is not 6, 0.375 or 24 (the wrong formulas)", () => {
    const received = quoteSwap(new D(3), entry(book, "A"), entry(book, "B")).receive.toNumber();
    expect([6, 0.375, 24]).not.toContain(received);
  });

  it("recomputes correctly when the direction is flipped: 3 B → 6 A", () => {
    const quote = quoteSwap(new D(3), entry(book, "B"), entry(book, "A"));
    expect(quote.receive.toFixed()).toBe("6");
    expect(quote.rate.toFixed()).toBe("2");
  });

  it("gives rate 1 for equal prices", () => {
    const equal = feed(["A", 5], ["B", 5]);
    expect(quoteSwap(new D("12.5"), entry(equal, "A"), entry(equal, "B")).receive.toFixed()).toBe(
      "12.5",
    );
  });

  it("truncates (never rounds up) at 8 decimals: 1 A at 0.1 into B at 0.3", () => {
    const thirds = feed(["A", 0.1], ["B", 0.3]);
    expect(quoteSwap(new D(1), entry(thirds, "A"), entry(thirds, "B")).receive.toFixed()).toBe(
      "0.33333333",
    );
    expect(quoteSwap(new D(2), entry(thirds, "A"), entry(thirds, "B")).receive.toFixed()).toBe(
      "0.66666666",
    );
  });

  it("handles the feed's extreme ratio without NaN, Infinity or exponent notation", () => {
    const quote = quoteSwap(new D("1000000000000"), entry(live, "WBTC"), entry(live, "SWTH"));
    expect(quote.receive.isFinite()).toBe(true);
    expect(quote.receive.toFixed()).not.toMatch(/e/i);
    // 1e12 × 26002.82202… / 0.00403985… ≈ 6.4366e18 (checked independently with Python decimal)
    expect(quote.receive.gt("6.4e18")).toBe(true);
    expect(quote.receive.lt("6.5e18")).toBe(true);
  });

  it("returns zero for an amount too small to survive 8 decimals", () => {
    const tiny = quoteSwap(new D("0.00000001"), entry(live, "SWTH"), entry(live, "WBTC"));
    expect(tiny.receive.isZero()).toBe(true);
  });
});

describe("validateSwap", () => {
  const prices = feed(["USD", 1], ["bNEO", 7.1282679], ["ZIL", 0.02]);
  const balances: Balances = { USD: "1800" };
  const base: SwapInput = { amountText: "100", from: "USD", to: "bNEO", prices, balances };
  const codes = (input: Partial<SwapInput>) =>
    validateSwap({ ...base, ...input }).issues.map((issue) => issue.code);

  it("accepts a valid swap and returns the quote", () => {
    const result = validateSwap(base);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.quote?.receive.toFixed()).toBe("14.02865344");
  });

  it.each([
    ["empty amount", { amountText: "" }, "amount_empty"],
    ["zero", { amountText: "0" }, "amount_not_positive"],
    ["negative", { amountText: "-5" }, "amount_not_positive"],
    ["NaN", { amountText: "NaN" }, "amount_malformed"],
    ["exponent", { amountText: "1e3" }, "amount_malformed"],
    ["malformed", { amountText: "1.2.3" }, "amount_malformed"],
    ["too precise", { amountText: "0.123456789" }, "amount_too_precise"],
    ["too large", { amountText: "1000000000001" }, "amount_too_large"],
    ["over balance", { amountText: "1800.00000001" }, "insufficient_balance"],
    ["prices not loaded", { prices: null }, "prices_unavailable"],
    ["no sender", { from: null }, "token_from_missing"],
    ["no receiver", { to: null }, "token_to_missing"],
    ["same token", { to: "USD" }, "same_token"],
    ["sender without a price", { from: "GHOST" }, "price_missing_from"],
    ["receiver without a price", { to: "GHOST" }, "price_missing_to"],
  ] as const)("reports %s", (_label, override, expected) => {
    expect(codes(override)).toContain(expected);
    expect(validateSwap({ ...base, ...override }).ok).toBe(false);
  });

  it("allows spending exactly the whole balance", () => {
    expect(validateSwap({ ...base, amountText: "1800" }).ok).toBe(true);
  });

  it("reports the field each message belongs next to", () => {
    const field = (input: Partial<SwapInput>) =>
      validateSwap({ ...base, ...input }).issues[0]?.field;
    expect(field({ amountText: "x" })).toBe("amount");
    expect(field({ to: "USD" })).toBe("to");
    expect(field({ from: null })).toBe("from");
    expect(field({ prices: null })).toBe("form");
  });

  it("still previews the quote when the balance is too low", () => {
    const result = validateSwap({ ...base, amountText: "5000" });
    expect(result.ok).toBe(false);
    expect(result.quote?.receive.toFixed()).toBe("701.43267202");
    expect(result.issues[0]).toMatchObject({
      code: "insufficient_balance",
      params: { symbol: "USD", balance: "1800" },
    });
  });

  it("has no quote when the pair cannot be priced", () => {
    expect(validateSwap({ ...base, to: "USD" }).quote).toBeNull();
    expect(validateSwap({ ...base, prices: null }).quote).toBeNull();
    expect(validateSwap({ ...base, amountText: "abc" }).quote).toBeNull();
  });

  it("rejects an amount whose receive side rounds to nothing", () => {
    const result = validateSwap({
      amountText: "0.00000001",
      from: "SWTH",
      to: "WBTC",
      prices: live,
      balances: { SWTH: "1" },
    });
    expect(result.issues.map((i) => i.code)).toContain("receive_too_small");
  });

  it("a token with no balance cannot be sent, whatever the amount", () => {
    expect(codes({ from: "ZIL", to: "USD", amountText: "1" })).toEqual(["insufficient_balance"]);
  });

  it("never produces NaN or Infinity in a quote", () => {
    for (const text of ["1", "0.00000001", "999999999999", "12,5"]) {
      const quote = validateSwap({ ...base, amountText: text, balances: { USD: "1e12" } }).quote;
      if (quote) {
        expect(quote.receive.isFinite()).toBe(true);
        expect(quote.rate.isFinite()).toBe(true);
      }
    }
  });
});

describe("applyMockSwap", () => {
  const prices = feed(["USD", 1], ["bNEO", 7.1282679]);
  const parsed = (text: string) => {
    const result = parseAmount(text);
    if (!result.ok) throw new Error(result.reason);
    return result.value;
  };

  it("debits the sender and credits the receiver in one step", () => {
    const amount = parsed("100");
    const { receive } = quoteSwap(amount, entry(prices, "USD"), entry(prices, "bNEO"));
    const result = applyMockSwap({ USD: "1800" }, { from: "USD", to: "bNEO", amount, receive });
    expect(result).toEqual({ ok: true, balances: { USD: "1700", bNEO: "14.02865344" } });
  });

  it("credits exactly the quoted amount (regression: quote showed 14.02 but wallet got 14.03)", () => {
    const amount = parsed("100");
    const quote = quoteSwap(amount, entry(prices, "USD"), entry(prices, "bNEO"));
    const result = applyMockSwap(
      { USD: "1800" },
      { from: "USD", to: "bNEO", amount, receive: quote.receive },
    );
    if (!result.ok) throw new Error(result.code);
    expect(balanceOf(result.balances, "bNEO").eq(quote.receive)).toBe(true);
  });

  it("adds to an existing balance without float drift", () => {
    const result = applyMockSwap(
      { USD: "0.3", bNEO: "0.1" },
      { from: "USD", to: "bNEO", amount: new D("0.1"), receive: new D("0.2") },
    );
    expect(result).toEqual({ ok: true, balances: { USD: "0.2", bNEO: "0.3" } });
  });

  it("removes a token whose balance reaches zero and keeps the total consistent", () => {
    const result = applyMockSwap(
      { USD: "1800" },
      { from: "USD", to: "bNEO", amount: new D("1800"), receive: new D("252.5") },
    );
    expect(result).toEqual({ ok: true, balances: { bNEO: "252.5" } });
  });

  it("refuses to go negative and leaves the input untouched", () => {
    const balances = Object.freeze({ USD: "50" });
    const result = applyMockSwap(balances, {
      from: "USD",
      to: "bNEO",
      amount: new D("50.00000001"),
      receive: new D(7),
    });
    expect(result).toEqual({ ok: false, code: "insufficient_balance" });
    expect(balances).toEqual({ USD: "50" });
  });

  it("does not mutate the previous snapshot on success", () => {
    const balances = Object.freeze({ USD: "100" });
    applyMockSwap(balances, { from: "USD", to: "bNEO", amount: new D(10), receive: new D(1) });
    expect(balances).toEqual({ USD: "100" });
  });

  it.each([
    ["same token", { from: "USD", to: "USD", amount: new D(1), receive: new D(1) }],
    ["zero amount", { from: "USD", to: "bNEO", amount: new D(0), receive: new D(1) }],
    ["negative amount", { from: "USD", to: "bNEO", amount: new D(-1), receive: new D(1) }],
    ["zero receive", { from: "USD", to: "bNEO", amount: new D(1), receive: new D(0) }],
  ])("rejects an invalid request: %s", (_label, request) => {
    expect(applyMockSwap({ USD: "10" }, request)).toEqual({ ok: false, code: "invalid_request" });
  });

  it("applying the same request twice cannot overspend (second one fails)", () => {
    const request = { from: "USD", to: "bNEO", amount: new D(1000), receive: new D(140) };
    const first = applyMockSwap({ USD: "1800" }, request);
    if (!first.ok) throw new Error("first swap should succeed");
    expect(applyMockSwap(first.balances, request)).toEqual({
      ok: false,
      code: "insufficient_balance",
    });
  });

  it("treats Object.prototype names as ordinary symbols", () => {
    const result = applyMockSwap(
      { USD: "10" },
      { from: "USD", to: "constructor", amount: new D(1), receive: new D(2) },
    );
    expect(result).toEqual({ ok: true, balances: { USD: "9", constructor: "2" } });
    expect(balanceOf({ USD: "10" }, "toString").toFixed()).toBe("0");
  });
});

describe("wallet limit (what the reload sanitizer would delete must never be credited)", () => {
  const junk = feed(["USD", 1], ["JUNK", 1e-20]);
  const balances: Balances = { USD: "1800" };

  it("validateSwap refuses a quote that would push a balance over the limit", () => {
    const result = validateSwap({
      amountText: "1800",
      from: "USD",
      to: "JUNK",
      prices: junk,
      balances,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("receive_too_large");
  });

  it("applyMockSwap refuses it as well, leaving the wallet untouched", () => {
    const quote = quoteSwap(new D(1800), entry(junk, "USD"), entry(junk, "JUNK"));
    const result = applyMockSwap(balances, {
      from: "USD",
      to: "JUNK",
      amount: new D(1800),
      receive: quote.receive,
    });
    expect(result).toEqual({ ok: false, code: "balance_limit" });
  });

  it("the largest allowed balance can be reached exactly, and not exceeded by the smallest unit", () => {
    const at = applyMockSwap(
      { USD: "1", T: "999999999999" },
      { from: "USD", to: "T", amount: new D(1), receive: new D(1) },
    );
    expect(at.ok).toBe(true);
    const over = applyMockSwap(
      { USD: "1", T: "999999999999.00000001" },
      { from: "USD", to: "T", amount: new D(1), receive: new D(1) },
    );
    expect(over).toEqual({ ok: false, code: "balance_limit" });
  });

  it("Max can always be typed: the largest balance equals the largest amount", () => {
    expect(parseAmount(formatDecimal(MAX_AMOUNT)).ok).toBe(true);
  });

  it("every swap result survives a reload (sanitizeBalances is the identity on it)", () => {
    let state = 0x9e3779b9;
    const rand = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    let wallet: Balances = { USD: "1800" };
    const symbols = ["USD", "bNEO", "ETH", "WBTC", "SWTH"];
    for (let i = 0; i < 300; i += 1) {
      const from = symbols[Math.floor(rand() * symbols.length)] ?? "USD";
      const to = symbols[Math.floor(rand() * symbols.length)] ?? "ETH";
      const held = balanceOf(wallet, from);
      if (held.lte(0) || from === to) continue;
      const amount = held.mul(rand()).toDecimalPlaces(8, D.ROUND_DOWN);
      if (amount.lte(0)) continue;
      const receive = amount.mul(rand() * 1000 + 0.001).toDecimalPlaces(8, D.ROUND_DOWN);
      if (receive.lte(0)) continue;
      const result = applyMockSwap(wallet, { from, to, amount, receive });
      if (result.ok) {
        expect(sanitizeBalances(result.balances), `step ${i}`).toEqual(result.balances);
        wallet = result.balances;
      }
    }
  });
});

describe("defaultPair", () => {
  const entries = normalizePriceData(SAMPLE_PRICE_RECORDS).entries;

  it("opens on USD → bNEO, like the original", () => {
    expect(defaultPair(entries, { USD: "1800" })).toEqual({ from: "USD", to: "bNEO" });
  });

  it("falls back to a token the wallet holds when USD is gone", () => {
    expect(defaultPair(entries, { ETH: "2" })).toEqual({ from: "ETH", to: "bNEO" });
  });

  it("never picks the same token on both sides", () => {
    expect(defaultPair(entries, { bNEO: "5" })).toEqual({ from: "bNEO", to: "BLUR" });
  });

  it("still offers USD when the wallet is empty, and handles an empty feed", () => {
    expect(defaultPair(entries, {})).toEqual({ from: "USD", to: "bNEO" });
    expect(defaultPair([], {})).toEqual({ from: null, to: null });
  });
});
