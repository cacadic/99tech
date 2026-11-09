import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCES, sanitizeBalances } from "./wallet";

describe("DEFAULT_BALANCES", () => {
  it("starts with 1800 USD, like the original Fancy Form", () => {
    expect(DEFAULT_BALANCES).toEqual({ USD: "1800" });
  });
});

describe("sanitizeBalances", () => {
  it("migrates the legacy 2-decimal strings", () => {
    expect(sanitizeBalances({ USD: "1700.00", bNEO: "14.03" })).toEqual({
      USD: "1700",
      bNEO: "14.03",
    });
  });

  it("accepts numbers and trims strings", () => {
    expect(sanitizeBalances({ USD: 5, ETH: " 0.5 " })).toEqual({ USD: "5", ETH: "0.5" });
  });

  it.each([
    ["negative", { USD: "-1" }],
    ["zero", { USD: "0.00" }],
    ["NaN", { USD: "NaN" }],
    ["Infinity", { USD: "Infinity" }],
    ["text", { USD: "lots" }],
    ["null", { USD: null }],
    ["object", { USD: {} }],
    ["dust below 8 decimals", { USD: "0.000000001" }],
    ["absurdly large", { USD: "1e30" }],
    ["unsafe symbol", { __proto__: "5", "bad key": "1" }],
  ])("drops an invalid entry: %s", (_label, input) => {
    expect(sanitizeBalances(input)).toBeNull();
  });

  it("keeps the good entries next to bad ones", () => {
    expect(sanitizeBalances({ USD: "10", ETH: "-3", BAD: "x" })).toEqual({ USD: "10" });
  });

  it.each([null, undefined, [], "USD", 5, true])(
    "returns null for non-object input %j",
    (input) => {
      expect(sanitizeBalances(input)).toBeNull();
    },
  );

  it("returns null for an empty wallet so the caller restores the default", () => {
    expect(sanitizeBalances({})).toBeNull();
  });

  it("does not let a hostile JSON payload pollute Object.prototype", () => {
    const parsed: unknown = JSON.parse('{"__proto__": {"polluted": "1"}, "USD": "1"}');
    expect(sanitizeBalances(parsed)).toEqual({ USD: "1" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
