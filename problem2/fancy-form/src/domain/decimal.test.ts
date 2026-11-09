import { describe, expect, it } from "vitest";
import {
  D,
  MAX_AMOUNT,
  formatAmount,
  formatDecimal,
  formatRate,
  formatUsd,
  groupThousands,
  parseAmount,
} from "./decimal";

const ok = (text: string): string => {
  const result = parseAmount(text);
  if (!result.ok) throw new Error(`expected "${text}" to parse, got ${result.reason}`);
  return result.value.toFixed();
};

describe("parseAmount", () => {
  it.each([
    ["12", "12"],
    ["12.5", "12.5"],
    ["  7  ", "7"],
    [".5", "0.5"],
    ["5.", "5"],
    ["0.00000001", "0.00000001"],
    ["12,5", "12.5"],
    ["1.123456780", "1.12345678"],
    ["007", "7"],
  ])("accepts %j as %s", (text, expected) => {
    expect(ok(text)).toBe(expected);
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["abc", "malformed"],
    ["NaN", "malformed"],
    ["Infinity", "malformed"],
    ["1e5", "malformed"],
    ["1E-3", "malformed"],
    ["0x10", "malformed"],
    ["+5", "malformed"],
    ["1.2.3", "malformed"],
    ["1,000.5", "malformed"],
    ["1,2,3", "malformed"],
    ["--5", "malformed"],
    ["5 5", "malformed"],
    ["0", "not_positive"],
    ["0.0", "not_positive"],
    [".0", "not_positive"],
    ["-5", "not_positive"],
    ["-0", "not_positive"],
    ["-0.5", "not_positive"],
    ["0.123456789", "too_precise"],
    ["1000000000000.00000001", "too_large"],
    ["99999999999999999999", "too_large"],
  ])("rejects %j as %s", (text, reason) => {
    expect(parseAmount(text)).toEqual({ ok: false, reason });
  });

  it("allows the documented maximum exactly", () => {
    expect(parseAmount(MAX_AMOUNT.toFixed()).ok).toBe(true);
  });
});

describe("formatting", () => {
  it("truncates instead of rounding up and never uses exponent notation", () => {
    expect(formatDecimal(new D("1.999999999"))).toBe("1.99999999");
    expect(formatDecimal(new D("0.000000001"))).toBe("0");
    expect(formatDecimal(new D("1e-7"))).toBe("0.0000001");
    expect(formatDecimal(new D("1700.00"))).toBe("1700");
    expect(formatDecimal(new D("123456789012.12345678"))).toBe("123456789012.12345678");
  });

  it("groups thousands in the integer part only", () => {
    expect(groupThousands("1234567.8912")).toBe("1,234,567.8912");
    expect(groupThousands("999")).toBe("999");
    expect(groupThousands("-1000")).toBe("-1,000");
    expect(formatAmount(new D("1800"))).toBe("1,800");
  });

  it("formats USD with two decimals and flags dust", () => {
    expect(formatUsd(new D("99.925"))).toBe("$99.93");
    expect(formatUsd(new D("100"))).toBe("$100.00");
    expect(formatUsd(new D("1234567.891"))).toBe("$1,234,567.89");
    expect(formatUsd(new D("0.004"))).toBe("<$0.01");
    expect(formatUsd(new D(0))).toBe("$0.00");
  });

  it("formats a rate with 8 significant digits", () => {
    expect(formatRate(new D(1).div(7.1282679))).toBe("0.14028653");
    expect(formatRate(new D("26002.82202020202"))).toBe("26,002.822");
    expect(formatRate(new D("0.0000001234567891"))).toBe("0.00000012345679");
  });
});

describe("D (isolated decimal)", () => {
  it("does not suffer from binary floating point", () => {
    expect(new D("0.1").plus("0.2").toFixed()).toBe("0.3");
    expect(0.1 + 0.2).not.toBe(0.3);
  });
});
