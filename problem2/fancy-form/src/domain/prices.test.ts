import { describe, expect, it } from "vitest";
import { SAMPLE_PRICE_RECORDS } from "@/shared/constants/samplePrices";
import { normalizePriceData } from "./prices";

const rec = (currency: string, date: string, price: unknown): unknown => ({
  currency,
  date,
  price,
});
const price = (raw: unknown, currency: string): string | undefined =>
  normalizePriceData(raw).book.get(currency)?.price.toFixed();

describe("normalizePriceData — real feed snapshot", () => {
  const result = normalizePriceData(SAMPLE_PRICE_RECORDS);

  it("keeps one entry for each of the 32 currencies and skips nothing", () => {
    expect(SAMPLE_PRICE_RECORDS).toHaveLength(36);
    expect(result.entries).toHaveLength(32);
    expect(result.skipped).toEqual([]);
  });

  it("preserves the feed's first-appearance order (default pair depends on it)", () => {
    expect(result.entries.slice(0, 4).map((e) => e.currency)).toEqual([
      "BLUR",
      "bNEO",
      "BUSD",
      "USD",
    ]);
  });

  it("selects the newest record for USDC, not the highest price (the original maxBy bug)", () => {
    // USDC has records at :30 (price 1, twice) and :40 (0.989832, then 0.9998782611186441).
    expect(price(SAMPLE_PRICE_RECORDS, "USDC")).toBe("0.9998782611186441");
    expect(price(SAMPLE_PRICE_RECORDS, "USDC")).not.toBe("1");
  });

  it("breaks timestamp ties by taking the later record in the feed (BUSD)", () => {
    expect(price(SAMPLE_PRICE_RECORDS, "BUSD")).toBe("0.9998782611186441");
  });

  it("reports the newest timestamp as asOf", () => {
    const newest = SAMPLE_PRICE_RECORDS.map((r) => (r as { date: string }).date)
      .sort()
      .at(-1);
    expect(result.asOf).toBe(newest);
  });
});

describe("normalizePriceData — selection rule", () => {
  it("prefers the newest timestamp regardless of feed order", () => {
    const ordered = [
      rec("AAA", "2023-01-01T00:00:00.000Z", 1),
      rec("AAA", "2023-01-02T00:00:00.000Z", 9),
    ];
    expect(price(ordered, "AAA")).toBe("9");
    expect(price([...ordered].reverse(), "AAA")).toBe("9");
  });

  it("prefers the newest even when it is cheaper", () => {
    const feed = [rec("AAA", "2023-01-01T00:00:00Z", 100), rec("AAA", "2023-06-01T00:00:00Z", 1)];
    expect(price(feed, "AAA")).toBe("1");
  });

  it("compares instants, not strings, across time zone offsets", () => {
    const feed = [
      rec("AAA", "2023-01-01T10:00:00+02:00", 1),
      rec("AAA", "2023-01-01T09:00:00Z", 2),
    ];
    // 10:00+02:00 is 08:00Z, so the 09:00Z record is newer.
    expect(price(feed, "AAA")).toBe("2");
  });

  it("accepts real calendar dates, including a leap day and an offset", () => {
    for (const date of [
      "2020-02-29",
      "2020-02-29T23:59:59.999Z",
      "2023-08-29T07:10:40.000+07:00",
    ]) {
      expect(price([rec("AAA", date, 3)], "AAA"), date).toBe("3");
    }
  });

  it("a fake date cannot beat a genuine newer record by rolling forward", () => {
    const feed = [rec("AAA", "2021-03-01T00:00:00Z", 1), rec("AAA", "2021-02-29T00:00:00Z", 999)];
    expect(price(feed, "AAA")).toBe("1");
  });

  it("accepts date-only timestamps", () => {
    expect(price([rec("AAA", "2023-01-01", 3)], "AAA")).toBe("3");
  });

  it("keeps equal prices for different tokens (rate is then exactly 1)", () => {
    const { book } = normalizePriceData([
      rec("AAA", "2023-01-01T00:00:00Z", 2),
      rec("BBB", "2023-01-01T00:00:00Z", 2),
    ]);
    expect(
      book
        .get("AAA")
        ?.price.div(book.get("BBB")?.price ?? 1)
        .toFixed(),
    ).toBe("1");
  });
});

describe("normalizePriceData — invalid input", () => {
  it.each([
    ["zero price", rec("AAA", "2023-01-01T00:00:00Z", 0), "invalid_price"],
    ["negative price", rec("AAA", "2023-01-01T00:00:00Z", -1), "invalid_price"],
    ["NaN price", rec("AAA", "2023-01-01T00:00:00Z", Number.NaN), "invalid_price"],
    [
      "Infinity price",
      rec("AAA", "2023-01-01T00:00:00Z", Number.POSITIVE_INFINITY),
      "invalid_price",
    ],
    ["string price", rec("AAA", "2023-01-01T00:00:00Z", "5"), "invalid_price"],
    ["missing price", { currency: "AAA", date: "2023-01-01T00:00:00Z" }, "invalid_price"],
    ["empty currency", rec("", "2023-01-01T00:00:00Z", 1), "invalid_currency"],
    ["blank currency", rec("  ", "2023-01-01T00:00:00Z", 1), "invalid_currency"],
    [
      "non-string currency",
      rec(5 as unknown as string, "2023-01-01T00:00:00Z", 1),
      "invalid_currency",
    ],
    ["__proto__ currency", rec("__proto__", "2023-01-01T00:00:00Z", 1), "invalid_currency"],
    ["currency with markup", rec("<img>", "2023-01-01T00:00:00Z", 1), "invalid_currency"],
    ["unparseable date", rec("AAA", "yesterday", 1), "invalid_date"],
    ["impossible date (month 13)", rec("AAA", "2023-13-45T00:00:00Z", 1), "invalid_date"],
    ["30 February", rec("AAA", "2021-02-30", 1), "invalid_date"],
    ["29 February in a common year", rec("AAA", "2021-02-29", 1), "invalid_date"],
    ["31 April", rec("AAA", "2021-04-31", 1), "invalid_date"],
    ["30 February with a time", rec("AAA", "2020-02-30T00:00:00Z", 1), "invalid_date"],
    ["hour 24", rec("AAA", "2020-01-01T24:00:00Z", 1), "invalid_date"],
    ["minute 60", rec("AAA", "2020-01-01T23:60:00Z", 1), "invalid_date"],
    ["offset beyond 23:59", rec("AAA", "2020-01-01T00:00:00+24:00", 1), "invalid_date"],
    ["zone-less date-time", rec("AAA", "2023-01-01T00:00:00", 1), "invalid_date"],
    ["missing date", { currency: "AAA", price: 1 }, "invalid_date"],
    ["numeric date", rec("AAA", 1672531200000 as unknown as string, 1), "invalid_date"],
    ["null record", null, "not_an_object"],
    ["array record", [], "not_an_object"],
    ["primitive record", 42, "not_an_object"],
  ])("skips a record with %s", (_label, record, reason) => {
    const result = normalizePriceData([record]);
    expect(result.entries).toEqual([]);
    expect(result.skipped).toEqual([{ index: 0, reason }]);
  });

  it("keeps valid records around invalid ones and reports the right index", () => {
    const result = normalizePriceData([
      rec("AAA", "2023-01-01T00:00:00Z", 1),
      rec("BAD", "never", 1),
      rec("BBB", "2023-01-01T00:00:00Z", 2),
    ]);
    expect(result.entries.map((e) => e.currency)).toEqual(["AAA", "BBB"]);
    expect(result.skipped).toEqual([{ index: 1, reason: "invalid_date" }]);
  });

  it("ignores an invalid newer record and keeps the newest *valid* one", () => {
    const result = normalizePriceData([
      rec("AAA", "2023-01-01T00:00:00Z", 5),
      rec("AAA", "2023-02-01T00:00:00Z", 0),
    ]);
    expect(result.book.get("AAA")?.price.toFixed()).toBe("5");
    expect(result.skipped).toHaveLength(1);
  });

  it.each([null, undefined, {}, "prices", 7, [[]]])("returns an empty book for %j", (payload) => {
    const result = normalizePriceData(payload);
    expect(result.entries).toEqual([]);
    expect(result.asOf).toBeNull();
  });
});
