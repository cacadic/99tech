import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useWalletStore } from "@/shared/hooks/use-wallet-store";
import WalletDetail from "./WalletDetail";

const trigger = () => screen.getByRole("button", { name: "Demo wallet a86ef1, show balances" });

describe("WalletDetail", () => {
  it("starts with 1,800 USD and says it is a simulation", async () => {
    const user = userEvent.setup();
    render(<WalletDetail />);
    await user.click(trigger());

    expect(await screen.findByTestId("balance-USD")).toHaveTextContent("1,800");
    expect(screen.getByText("Simulated balances. Nothing is on-chain.")).toBeInTheDocument();
  });

  it("lists every token the wallet holds, including ones without a price, and updates after a swap", async () => {
    useWalletStore.setState({ coins: { USD: "1700", bNEO: "14.02865344", UNPRICED: "3" } });
    const user = userEvent.setup();
    render(<WalletDetail />);
    await user.click(trigger());

    expect(await screen.findByTestId("balance-USD")).toHaveTextContent("1,700");
    expect(screen.getByTestId("balance-bNEO")).toHaveTextContent("14.02865344");
    expect(screen.getByTestId("balance-UNPRICED")).toHaveTextContent("3");
  });

  it("filters by search and offers an empty state", async () => {
    useWalletStore.setState({ coins: { USD: "10", ETH: "2" } });
    const user = userEvent.setup();
    render(<WalletDetail />);
    await user.click(trigger());

    const search = await screen.findByRole("combobox", { name: "Search coin..." });
    await user.type(search, "et");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.getByText("No coin found.")).toBeInTheDocument();
  });

  it("cannot be reset while a swap is in flight", async () => {
    useWalletStore.setState({ coins: { ETH: "2" }, pendingSwap: true });
    const user = userEvent.setup();
    render(<WalletDetail />);
    await user.click(trigger());

    const reset = await screen.findByRole("button", { name: "Reset demo balance" });
    expect(reset).toBeDisabled();
    await user.click(reset);
    expect(useWalletStore.getState().coins).toEqual({ ETH: "2" });
  });

  it("resets the demo balance to 1,800 USD", async () => {
    useWalletStore.setState({ coins: { ETH: "2" } });
    const user = userEvent.setup();
    render(<WalletDetail />);
    await user.click(trigger());
    await user.click(await screen.findByRole("button", { name: "Reset demo balance" }));

    expect(useWalletStore.getState().coins).toEqual({ USD: "1800" });
    expect(within(document.body).getByTestId("balance-USD")).toHaveTextContent("1,800");
  });
});
