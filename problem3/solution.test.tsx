import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletDataProvider } from "./context";
import WalletPage, { WalletPage as NamedWalletPage } from "./solution";
import type { PriceMap, WalletBalance } from "./types";
import { toRows } from "./wallet-utils";

vi.mock("./wallet-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./wallet-utils")>();
  return { ...actual, toRows: vi.fn(actual.toRows) };
});

const bal = (blockchain: string, currency: string, amount: number): WalletBalance => ({
  blockchain,
  currency,
  amount,
});

const PRICES: PriceMap = { OSMO: 0.5, ETH: 2000, ARB: 1, ZIL: 0.02, NEO: 10 };

function Data({ balances, prices = PRICES, children }: { balances: WalletBalance[]; prices?: PriceMap; children: ReactNode }) {
  return (
    <WalletDataProvider balances={balances} prices={prices}>
      {children}
    </WalletDataProvider>
  );
}

const rowsOf = () => screen.queryAllByTestId("wallet-row");
const currencies = () => rowsOf().map((row) => within(row).getByText(/./, { selector: '[data-field="currency"]' }).textContent);
const field = (row: HTMLElement, name: string) => row.querySelector(`[data-field="${name}"]`)?.textContent;

afterEach(() => {
  vi.mocked(toRows).mockClear();
  vi.restoreAllMocks();
});

describe("WalletPage", () => {
  it("exports the same component as default and by name", () => {
    expect(WalletPage).toBe(NamedWalletPage);
  });

  it("renders only real balances, highest priority first", () => {
    const balances = [
      bal("Neo", "NEO", 3),
      bal("Bitcoin", "BTC", 1),
      bal("Osmosis", "OSMO", 100),
      bal("Ethereum", "ETH", 0),
      bal("Zilliqa", "ZIL", 1000),
      bal("Arbitrum", "ARB", -2),
      bal("Ethereum", "WETH", 1.5),
    ];
    render(
      <Data balances={balances}>
        <WalletPage />
      </Data>,
    );
    // The original kept ETH (0), ARB (-2) and dropped everything else.
    expect(currencies()).toEqual(["OSMO", "WETH", "NEO", "ZIL"]);
  });

  it("shows formatted amount and USD value per row", () => {
    render(
      <Data balances={[bal("Osmosis", "OSMO", 1234.5)]}>
        <WalletPage />
      </Data>,
    );
    const [row] = rowsOf();
    expect(field(row!, "amount")).toBe("1,234.5");
    expect(field(row!, "usd")).toBe("$617.25");
  });

  it("renders a placeholder, never NaN, when the price is missing", () => {
    render(
      <Data balances={[bal("Ethereum", "WETH", 2), bal("Osmosis", "OSMO", 2)]}>
        <WalletPage />
      </Data>,
    );
    const [weth, osmo] = [rowsOf()[1]!, rowsOf()[0]!];
    expect(field(weth, "usd")).toBe("—");
    expect(field(osmo, "usd")).toBe("$1.00");
    expect(document.body.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("renders no rows (and does not crash) for an empty list or empty prices", () => {
    const { rerender } = render(
      <Data balances={[]} prices={{}}>
        <WalletPage data-testid="page" />
      </Data>,
    );
    expect(rowsOf()).toHaveLength(0);
    expect(screen.getByTestId("page")).toBeEmptyDOMElement();

    rerender(
      <Data balances={[bal("Neo", "NEO", 1)]} prices={{}}>
        <WalletPage data-testid="page" />
      </Data>,
    );
    expect(rowsOf()).toHaveLength(1);
    expect(field(rowsOf()[0]!, "usd")).toBe("—");
  });

  it("renders children and forwards DOM props to the wrapper", () => {
    render(
      <Data balances={[bal("Neo", "NEO", 1)]}>
        <WalletPage id="wallet" className="page" aria-label="Wallet" data-testid="page">
          <h2>Your wallet</h2>
        </WalletPage>
      </Data>,
    );
    const page = screen.getByTestId("page");
    expect(page).toHaveAttribute("id", "wallet");
    expect(page).toHaveClass("page");
    expect(page).toHaveAttribute("aria-label", "Wallet");
    expect(within(page).getByRole("heading", { name: "Your wallet" })).toBeInTheDocument();
    expect(page.firstElementChild?.tagName).toBe("H2"); // children first, rows after
  });

  it("applies rowClassName to rows only and does not leak it to the DOM wrapper", () => {
    render(
      <Data balances={[bal("Neo", "NEO", 1), bal("Osmosis", "OSMO", 1)]}>
        <WalletPage data-testid="page" rowClassName="row" />
      </Data>,
    );
    const page = screen.getByTestId("page");
    expect(page).not.toHaveAttribute("rowclassname");
    expect(page).not.toHaveClass("row");
    for (const row of rowsOf()) expect(row).toHaveClass("row");
  });

  it("does not mutate the balances array it receives", () => {
    const balances = [bal("Neo", "NEO", 1), bal("Osmosis", "OSMO", 1)];
    const snapshot = balances.map((b) => ({ ...b }));
    render(
      <Data balances={balances}>
        <WalletPage />
      </Data>,
    );
    expect(balances).toEqual(snapshot);
  });

  it("does not warn about duplicate or missing keys, even for exact duplicates", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <Data balances={[bal("Neo", "NEO", 1), bal("Neo", "NEO", 2), bal("Osmosis", "OSMO", 1)]}>
        <WalletPage />
      </Data>,
    );
    expect(rowsOf()).toHaveLength(3);
    expect(error).not.toHaveBeenCalled();
  });
});

describe("row identity (keys)", () => {
  const first = [bal("Osmosis", "OSMO", 1), bal("Neo", "NEO", 1), bal("Zilliqa", "ZIL", 1)];

  const nodeFor = (currency: string): HTMLElement => {
    const row = rowsOf().find((r) => field(r, "currency") === currency);
    if (!row) throw new Error(`no row for ${currency}`);
    return row;
  };

  it("keeps the same DOM node for the same balance when the order changes", () => {
    const { rerender } = render(
      <Data balances={first}>
        <WalletPage />
      </Data>,
    );
    const before = { OSMO: nodeFor("OSMO"), NEO: nodeFor("NEO"), ZIL: nodeFor("ZIL") };
    expect(currencies()).toEqual(["OSMO", "NEO", "ZIL"]);

    // A higher-priority row appears in the middle of the list; everything below it shifts down.
    rerender(
      <Data balances={[bal("Ethereum", "ETH", 1), ...first]}>
        <WalletPage />
      </Data>,
    );
    expect(currencies()).toEqual(["OSMO", "ETH", "NEO", "ZIL"]);
    expect(nodeFor("ETH")).not.toBe(before.OSMO);
    expect(nodeFor("OSMO")).toBe(before.OSMO);
    expect(nodeFor("NEO")).toBe(before.NEO);
    expect(nodeFor("ZIL")).toBe(before.ZIL);
  });

  it("keeps the remaining nodes when a row above them disappears", () => {
    const { rerender } = render(
      <Data balances={first}>
        <WalletPage />
      </Data>,
    );
    const neo = nodeFor("NEO");
    const zil = nodeFor("ZIL");

    // OSMO is spent down to 0, so its row is removed and NEO / ZIL move up one position.
    rerender(
      <Data balances={[bal("Osmosis", "OSMO", 0), ...first.slice(1)]}>
        <WalletPage />
      </Data>,
    );
    expect(currencies()).toEqual(["NEO", "ZIL"]);
    expect(nodeFor("NEO")).toBe(neo);
    expect(nodeFor("ZIL")).toBe(zil);
  });

  it("legacy key={index} hands a node to a different balance as soon as the order changes", () => {
    // Minimal reproduction of the original `key={index}` rendering.
    function LegacyList({ items }: { items: string[] }) {
      return (
        <ul>
          {items.map((name, index) => (
            <li key={index}>{name}</li>
          ))}
        </ul>
      );
    }
    const { rerender, container } = render(<LegacyList items={["OSMO", "NEO"]} />);
    const osmoNode = container.querySelector("li");
    expect(osmoNode?.textContent).toBe("OSMO");

    rerender(<LegacyList items={["ETH", "OSMO", "NEO"]} />);
    // The node that represented OSMO now represents ETH: any per-row state would be wrong.
    expect(container.querySelector("li")).toBe(osmoNode);
    expect(osmoNode?.textContent).toBe("ETH");
  });
});

describe("useMemo", () => {
  it("does not recompute rows when only unrelated props change", () => {
    const balances = [bal("Osmosis", "OSMO", 1)];
    const ui = (className: string) => (
      <Data balances={balances}>
        <WalletPage className={className} />
      </Data>
    );
    const { rerender } = render(ui("a"));
    expect(toRows).toHaveBeenCalledTimes(1);
    rerender(ui("b"));
    rerender(ui("c"));
    expect(toRows).toHaveBeenCalledTimes(1);
  });

  it("recomputes when balances or prices change, and shows the new values", () => {
    const balances = [bal("Osmosis", "OSMO", 2)];
    const { rerender } = render(
      <Data balances={balances} prices={{ OSMO: 1 }}>
        <WalletPage />
      </Data>,
    );
    expect(field(rowsOf()[0]!, "usd")).toBe("$2.00");

    rerender(
      <Data balances={balances} prices={{ OSMO: 3 }}>
        <WalletPage />
      </Data>,
    );
    expect(toRows).toHaveBeenCalledTimes(2);
    expect(field(rowsOf()[0]!, "usd")).toBe("$6.00");

    rerender(
      <Data balances={[bal("Osmosis", "OSMO", 4)]} prices={{ OSMO: 3 }}>
        <WalletPage />
      </Data>,
    );
    expect(toRows).toHaveBeenCalledTimes(3);
    expect(field(rowsOf()[0]!, "usd")).toBe("$12.00");
  });
});
