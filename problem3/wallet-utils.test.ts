import { describe, expect, it } from "vitest";
import type { PriceMap, WalletBalance } from "./types";
import {
  compareBalances,
  formatAmount,
  formatUsd,
  getPriority,
  isDisplayable,
  PLACEHOLDER,
  rowKey,
  toRows,
  usdValue,
} from "./wallet-utils";

const bal = (blockchain: string, currency: string, amount: number): WalletBalance => ({
  blockchain,
  currency,
  amount,
});

/**
 * The original (reconstructed) logic with only the undefined `lhsPriority` renamed to the variable
 * that was actually declared, so it can run at all. Everything else is as written in the challenge.
 */
function legacyPriority(blockchain: unknown): number {
  switch (blockchain) {
    case "Osmosis":
      return 100;
    case "Ethereum":
      return 50;
    case "Arbitrum":
      return 30;
    case "Zilliqa":
      return 20;
    case "Neo":
      return 20;
    default:
      return -99;
  }
}

function legacySorted(balances: WalletBalance[]): WalletBalance[] {
  return balances
    .filter((balance) => {
      const balancePriority = legacyPriority(balance.blockchain);
      if (balancePriority > -99) {
        if (balance.amount <= 0) {
          return true;
        }
      }
      return false;
    })
    .sort((lhs, rhs) => {
      const leftPriority = legacyPriority(lhs.blockchain);
      const rightPriority = legacyPriority(rhs.blockchain);
      if (leftPriority > rightPriority) {
        return -1;
      } else if (rightPriority > leftPriority) {
        return 1;
      }
      return 0;
    });
}

describe("legacy logic (documents what the original did, proves the tests can fail)", () => {
  const data = [bal("Osmosis", "OSMO", 5), bal("Neo", "NEO", 0), bal("Ethereum", "ETH", -1)];

  it("keeps only EMPTY / negative balances and drops the real one", () => {
    expect(legacySorted(data).map((b) => b.currency)).toEqual(["ETH", "NEO"]);
  });

  it("the refactor keeps exactly the opposite set", () => {
    expect(toRows(data, {}).map((r) => r.currency)).toEqual(["OSMO"]);
  });

  it("the original sort leaves tie order to whatever order the input had", () => {
    const a = [bal("Zilliqa", "ZIL", 0), bal("Neo", "NEO", 0)];
    expect(legacySorted(a).map((b) => b.currency)).toEqual(["ZIL", "NEO"]);
    expect(legacySorted([...a].reverse()).map((b) => b.currency)).toEqual(["NEO", "ZIL"]);
  });

  it("the original throws ReferenceError on any non-empty list", () => {
    // `lhsPriority` is not declared anywhere in the snippet.
    const original = (balances: WalletBalance[]) =>
      balances.filter((balance) => {
        const balancePriority = legacyPriority(balance.blockchain);
        // @ts-expect-error reproduces the undeclared identifier from the challenge snippet
        if (lhsPriority > -99) return balancePriority > 0;
        return false;
      });
    expect(() => original([])).not.toThrow();
    expect(() => original([bal("Neo", "NEO", 1)])).toThrow(ReferenceError);
  });
});

describe("getPriority", () => {
  it.each([
    ["Osmosis", 100],
    ["Ethereum", 50],
    ["Arbitrum", 30],
    ["Zilliqa", 20],
    ["Neo", 20],
  ])("%s -> %i", (chain, expected) => {
    expect(getPriority(chain)).toBe(expected);
  });

  it.each(["Bitcoin", "", "osmosis", "constructor", "__proto__", "toString", "hasOwnProperty"])(
    "unknown chain %j -> -99 (prototype members are not chains)",
    (chain) => {
      expect(getPriority(chain)).toBe(-99);
    },
  );
});

describe("isDisplayable", () => {
  it("keeps a positive balance on a known chain", () => {
    expect(isDisplayable(bal("Osmosis", "OSMO", 0.000001))).toBe(true);
  });

  it.each([
    ["zero", 0],
    ["negative", -5],
    ["negative zero", -0],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ])("rejects %s amount", (_label, amount) => {
    expect(isDisplayable(bal("Osmosis", "OSMO", amount))).toBe(false);
  });

  it("rejects an unknown blockchain even with a positive amount", () => {
    expect(isDisplayable(bal("Bitcoin", "BTC", 10))).toBe(false);
  });
});

describe("compareBalances", () => {
  it("orders by priority, highest first", () => {
    const sorted = [
      bal("Neo", "NEO", 1),
      bal("Osmosis", "OSMO", 1),
      bal("Arbitrum", "ARB", 1),
      bal("Ethereum", "ETH", 1),
      bal("Zilliqa", "ZIL", 1),
    ].sort(compareBalances);
    expect(sorted.map((b) => b.blockchain)).toEqual(["Osmosis", "Ethereum", "Arbitrum", "Neo", "Zilliqa"]);
  });

  it("returns a number for equal priorities, never undefined", () => {
    expect(typeof compareBalances(bal("Neo", "A", 1), bal("Neo", "A", 1))).toBe("number");
    expect(compareBalances(bal("Neo", "A", 1), bal("Neo", "A", 1))).toBe(0);
  });

  it("breaks the Zilliqa/Neo tie by currency, then blockchain", () => {
    expect(compareBalances(bal("Neo", "AAA", 1), bal("Zilliqa", "BBB", 1))).toBeLessThan(0);
    expect(compareBalances(bal("Zilliqa", "AAA", 1), bal("Neo", "AAA", 1))).toBeGreaterThan(0);
  });

  it("is antisymmetric", () => {
    const a = bal("Zilliqa", "X", 1);
    const b = bal("Neo", "Y", 2);
    expect(Math.sign(compareBalances(a, b))).toBe(-Math.sign(compareBalances(b, a)));
  });
});

describe("formatAmount", () => {
  it("keeps fractions that toFixed() would round away", () => {
    expect(formatAmount(0.5)).toBe("0.5");
    expect(formatAmount(1234.5678)).toBe("1,234.5678");
    expect((0.5).toFixed()).toBe("1"); // the original behaviour, for contrast
  });

  it("does not turn a small positive balance into 0", () => {
    expect(formatAmount(0.000001234)).toBe("0.00000123");
    expect(formatAmount(1e-12)).toBe("<0.00000001");
    expect((0.000001234).toFixed()).toBe("0");
  });

  it("never prints exponent notation for huge numbers", () => {
    expect(formatAmount(1e21)).not.toMatch(/e/i);
  });

  it("returns a placeholder for NaN / Infinity instead of 'NaN' / 'Infinity'", () => {
    expect(formatAmount(Number.NaN)).toBe(PLACEHOLDER);
    expect(formatAmount(Number.POSITIVE_INFINITY)).toBe(PLACEHOLDER);
  });

  it("prints zero without a sign", () => {
    expect(formatAmount(-0)).toBe("0");
  });
});

describe("formatUsd", () => {
  it("formats currency and uses a placeholder for null", () => {
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(null)).toBe(PLACEHOLDER);
    expect(formatUsd(Number.NaN)).toBe(PLACEHOLDER);
  });
});

describe("usdValue", () => {
  const prices: PriceMap = { OSMO: 0.5, ETH: 2000, ZERO: 0, NEG: -1, BAD: Number.NaN, INF: Number.POSITIVE_INFINITY };

  it("multiplies amount by price", () => {
    expect(usdValue(bal("Osmosis", "OSMO", 10), prices)).toBe(5);
  });

  it("is null (not NaN) when the price is missing", () => {
    expect(usdValue(bal("Neo", "NEO", 10), prices)).toBeNull();
    expect(usdValue(bal("Neo", "NEO", 10), {})).toBeNull();
    expect(prices["NEO"]! * 10).toBeNaN(); // the original behaviour, for contrast
  });

  it.each(["ZERO", "NEG", "BAD", "INF"])("is null for an invalid price (%s)", (currency) => {
    expect(usdValue(bal("Neo", currency, 10), prices)).toBeNull();
  });

  it("does not read prototype members as prices", () => {
    expect(usdValue(bal("Neo", "constructor", 10), {})).toBeNull();
    expect(usdValue(bal("Neo", "toString", 10), {})).toBeNull();
  });

  it("is null when the product overflows", () => {
    expect(usdValue(bal("Neo", "ETH", Number.MAX_VALUE), prices)).toBeNull();
  });
});

describe("toRows", () => {
  const prices: PriceMap = { OSMO: 0.5, ETH: 2000, ARB: 1, ZIL: 0.02, NEO: 10 };
  const input = [
    bal("Neo", "NEO", 3),
    bal("Bitcoin", "BTC", 1),
    bal("Osmosis", "OSMO", 100),
    bal("Ethereum", "ETH", 0),
    bal("Zilliqa", "ZIL", 1000),
    bal("Arbitrum", "ARB", Number.NaN),
    bal("Ethereum", "WETH", 1.5),
  ];

  it("filters, sorts, formats and values in one pass", () => {
    const rows = toRows(input, prices);
    expect(rows.map((r) => r.key)).toEqual(["Osmosis:OSMO", "Ethereum:WETH", "Neo:NEO", "Zilliqa:ZIL"]);
    expect(rows.map((r) => r.formatted)).toEqual(["100", "1.5", "3", "1,000"]);
    expect(rows.map((r) => r.usdValue)).toEqual([50, null, 30, 20]);
  });

  it("does not mutate the input array or its items", () => {
    const copy = structuredClone(input);
    const frozen = Object.freeze([...input]);
    expect(() => toRows(frozen, prices)).not.toThrow();
    expect(input).toEqual(copy);
  });

  it("gives the same output for any input order (deterministic ties)", () => {
    const tied = [bal("Zilliqa", "B", 1), bal("Neo", "A", 1), bal("Zilliqa", "A", 1), bal("Neo", "B", 1)];
    const expected = toRows(tied, {}).map((r) => r.key);
    for (const permutation of [[...tied].reverse(), [tied[2]!, tied[0]!, tied[3]!, tied[1]!]]) {
      expect(toRows(permutation, {}).map((r) => r.key)).toEqual(expected);
    }
    expect(expected).toEqual(["Neo:A", "Zilliqa:A", "Neo:B", "Zilliqa:B"]);
  });

  it("returns [] for an empty list", () => {
    expect(toRows([], prices)).toEqual([]);
  });

  it("gives every row a unique key, even for exact duplicates", () => {
    const rows = toRows([bal("Neo", "NEO", 1), bal("Neo", "NEO", 2), bal("Neo", "NEO", 3)], prices);
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(3);
    expect(keys).toEqual(["Neo:NEO", "Neo:NEO#2", "Neo:NEO#3"]);
    expect(rows.map((r) => r.amount)).toEqual([3, 2, 1]);
  });

  it("uses blockchain + currency so the same currency on two chains does not collide", () => {
    const keys = toRows([bal("Neo", "USDC", 1), bal("Zilliqa", "USDC", 1)], {}).map((r) => r.key);
    expect(keys).toEqual(["Neo:USDC", "Zilliqa:USDC"]);
    expect(rowKey(bal("Neo", "USDC", 1))).toBe("Neo:USDC");
  });
});
