import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SAMPLE_PRICE_RECORDS } from "@/shared/constants/samplePrices";
import { tokenIconUrl } from "@/shared/lib/tokenIcons";
import { TokenIcon } from "./TokenIcon";

describe("token icons", () => {
  it("has an icon for every currency in the price feed (matching is case-insensitive)", () => {
    const currencies = [
      ...new Set(SAMPLE_PRICE_RECORDS.map((r) => (r as { currency: string }).currency)),
    ];
    expect(currencies).toHaveLength(32);
    const missing = currencies.filter((symbol) => tokenIconUrl(symbol) === undefined);
    expect(missing).toEqual([]);
    expect(tokenIconUrl("STEVMOS")).toBe(tokenIconUrl("stEVMOS"));
  });

  it("renders the logo as a decorative image", () => {
    const { container } = render(<TokenIcon symbol="ETH" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByTestId("token-icon-fallback")).not.toBeInTheDocument();
  });

  it("falls back to the initial letter for an unknown token", () => {
    render(<TokenIcon symbol="zzz" />);
    expect(screen.getByTestId("token-icon-fallback")).toHaveTextContent("Z");
  });

  it("falls back to the initial letter when the image fails to load", () => {
    const { container } = render(<TokenIcon symbol="ETH" />);
    const img = container.querySelector("img");
    if (img === null) throw new Error("expected an <img>");
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("token-icon-fallback")).toHaveTextContent("E");
  });
});
