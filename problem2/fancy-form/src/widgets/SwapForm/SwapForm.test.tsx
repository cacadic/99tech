import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { normalizePriceData } from "@/domain/prices";
import { useWalletStore } from "@/shared/hooks/use-wallet-store";
import { usePriceStore } from "@/shared/hooks/use-price-store";
import {
  EASY_FEED,
  feed,
  instantBackend,
  jsonResponse,
  manualBackend,
  renderWithToaster,
  stubFetch,
} from "@/test/helpers";
import type { SwapBackend } from "@/shared/api/mockSwapBackend";
import SwapForm from "./SwapForm";

const normalized = (records: unknown) => {
  const { entries, book } = normalizePriceData(records);
  return { entries, book };
};

async function openForm(options: { records?: unknown; backend?: SwapBackend } = {}) {
  stubFetch(() => jsonResponse(options.records ?? EASY_FEED));
  const user = userEvent.setup();
  renderWithToaster(<SwapForm backend={options.backend ?? instantBackend().backend} />);
  await screen.findByRole("heading", { name: "Swap" });
  return user;
}

const sendInput = () => screen.getByRole("textbox", { name: "Amount to Send" });
const receiveInput = () => screen.getByRole("textbox", { name: "Amount to Receive" });
const confirmButton = () => screen.getByRole("button", { name: /Confirm Swap|Swapping/ });
const coins = () => useWalletStore.getState().coins;

async function chooseToken(
  user: ReturnType<typeof userEvent.setup>,
  which: "send" | "receive",
  symbol: string,
) {
  await user.click(
    screen.getByRole("combobox", { name: which === "send" ? "Token to send" : "Token to receive" }),
  );
  await user.click(await screen.findByRole("option", { name: new RegExp(`^${symbol}`) }));
}

describe("SwapForm — what is on screen", () => {
  it("shows the real form: two token selectors, both amount fields, MAX, switch and a disabled CTA", async () => {
    await openForm();

    expect(screen.getByRole("combobox", { name: "Token to send" })).toHaveTextContent("USD");
    expect(screen.getByRole("combobox", { name: "Token to receive" })).toHaveTextContent("bNEO");
    expect(sendInput()).toBeInTheDocument();
    expect(receiveInput()).toHaveAttribute("readonly");
    expect(screen.getByText("Amount to Send")).toBeInTheDocument();
    expect(screen.getByText("Amount to Receive")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Max" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Swap sending and receiving tokens" }),
    ).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByTestId("send-balance")).toHaveTextContent("Balance: 1,800 USD");
    expect(screen.queryByText(/scaffold ready/i)).not.toBeInTheDocument();
  });

  it("shows an accessible loading state until prices arrive", () => {
    stubFetch(() => new Promise<Response>(() => undefined));
    renderWithToaster(<SwapForm />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading prices…");
    expect(screen.queryByRole("heading", { name: "Swap" })).not.toBeInTheDocument();
  });

  it("labels live prices as live, with the data date", async () => {
    await openForm();
    const status = screen.getByTestId("price-status");
    expect(status).toHaveAttribute("data-source", "live");
    expect(status).toHaveTextContent("Live prices · as of Aug 29, 2023");
    expect(screen.getByText("Demo only: simulated swap, no real funds.")).toBeInTheDocument();
  });
});

describe("SwapForm — quote", () => {
  it("3 USD at $2 into bNEO at $4 shows exactly 1.5 (and its USD value, and the rate)", async () => {
    const user = await openForm();
    await user.type(sendInput(), "3");

    expect(receiveInput()).toHaveValue("1.5");
    expect(screen.getByTestId("send-usd")).toHaveTextContent("$6.00");
    expect(screen.getByTestId("receive-usd")).toHaveTextContent("$6.00");
    expect(screen.getByTestId("rate")).toHaveTextContent("1 USD ≈ 0.5 bNEO");
    expect(confirmButton()).toBeEnabled();
  });

  it("recomputes when the token pair or the amount changes, without resetting what was typed", async () => {
    const user = await openForm();
    await user.type(sendInput(), "10");
    expect(receiveInput()).toHaveValue("5");

    await chooseToken(user, "receive", "ETH");
    expect(sendInput()).toHaveValue("10");
    expect(receiveInput()).toHaveValue("0.01");

    await user.clear(sendInput());
    await user.type(sendInput(), "1000");
    expect(receiveInput()).toHaveValue("1");
  });

  it("accepts a decimal comma and never renders NaN or Infinity", async () => {
    const user = await openForm();
    await user.type(sendInput(), "1,5");
    expect(receiveInput()).toHaveValue("0.75");
    for (const text of ["abc", "1e5", "-", "."]) {
      await user.clear(sendInput());
      await user.type(sendInput(), text);
      expect(receiveInput()).not.toHaveValue("NaN");
      expect(document.body).not.toHaveTextContent(/NaN|Infinity/);
    }
  });
});

describe("SwapForm — validation messages sit next to the field", () => {
  it.each([
    ["0", "Amount must be greater than 0."],
    ["-5", "Amount must be greater than 0."],
    ["abc", "Enter a valid number, for example 12.5."],
    ["1e3", "Enter a valid number, for example 12.5."],
    ["1.2.3", "Enter a valid number, for example 12.5."],
    ["0.123456789", "Use at most 8 decimal places."],
    ["1000000000001", "Amount is too large."],
    ["1800.00000001", "Insufficient balance: 1,800 USD"],
  ])("typing %j explains the problem and blocks Confirm", async (typed, message) => {
    const user = await openForm();
    await user.type(sendInput(), typed);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(sendInput()).toHaveAttribute("aria-invalid", "true");
    expect(sendInput()).toHaveAccessibleDescription(message);
    expect(confirmButton()).toBeDisabled();
  });

  it("stays quiet for an empty field; the disabled Confirm button covers it, and Enter does nothing", async () => {
    const { backend, submit } = instantBackend();
    const user = await openForm({ backend });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();

    await user.type(sendInput(), "{Enter}");
    expect(submit).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("flags the same token on both sides", async () => {
    const user = await openForm();
    await user.type(sendInput(), "5");
    await chooseToken(user, "receive", "USD");

    expect(await screen.findByRole("alert")).toHaveTextContent("Choose two different tokens.");
    expect(confirmButton()).toBeDisabled();
    expect(receiveInput()).toHaveValue("");
  });

  it("allows spending exactly the whole balance", async () => {
    const user = await openForm();
    await user.type(sendInput(), "1800");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });
});

describe("SwapForm — a sender whose price disappears after a refresh", () => {
  it("explains it next to the sender selector and ties the message to it for assistive technology", async () => {
    await openForm();
    act(() => {
      usePriceStore.setState(normalized(feed(["bNEO", 4], ["ETH", 2000])));
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No price available for USD.");
    const sender = screen.getByRole("combobox", { name: "Token to send" });
    expect(sender).toHaveAttribute("aria-invalid", "true");
    expect(sender).toHaveAccessibleDescription("No price available for USD.");
  });
});

describe("SwapForm — token selectors", () => {
  it("offers only tokens that have a price, and search filters them", async () => {
    const user = await openForm({
      records: [...EASY_FEED, { currency: "BROKEN", date: "2023-01-01T00:00:00Z", price: 0 }],
    });
    await user.click(screen.getByRole("combobox", { name: "Token to receive" }));

    const names = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(names).toHaveLength(3);
    expect(names.join(" ")).not.toContain("BROKEN");

    await user.type(screen.getByRole("combobox", { name: "Search coin..." }), "et");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /ETH/ })).toBeInTheDocument();

    await user.clear(screen.getByRole("combobox", { name: "Search coin..." }));
    await user.type(screen.getByRole("combobox", { name: "Search coin..." }), "zzz");
    expect(screen.getByText("No coin found.")).toBeInTheDocument();
  });

  it("shows tokens the wallet does not hold as unavailable for sending, and the owned one as selectable", async () => {
    const user = await openForm();
    await user.click(screen.getByRole("combobox", { name: "Token to send" }));

    const usd = await screen.findByRole("option", { name: /USD/ });
    const eth = screen.getByRole("option", { name: /ETH/ });
    expect(usd).not.toHaveAttribute("aria-disabled", "true");
    expect(usd).toHaveTextContent("1,800");
    expect(eth).toHaveAttribute("aria-disabled", "true");
    expect(eth).toHaveTextContent("No balance");
  });

  it("can send a token received in an earlier swap", async () => {
    useWalletStore.setState({ coins: { USD: "10", ETH: "2" } });
    const user = await openForm();
    await chooseToken(user, "send", "ETH");
    await user.type(sendInput(), "1");
    expect(receiveInput()).toHaveValue("500"); // 1 ETH ($2000) / bNEO ($4)
    expect(confirmButton()).toBeEnabled();
  });
});

describe("SwapForm — MAX and switch direction", () => {
  it("MAX fills the exact balance, not a 2-decimal rounding of it", async () => {
    useWalletStore.setState({ coins: { USD: "1234.56789012" } });
    const user = await openForm();
    await user.click(screen.getByRole("button", { name: "Max" }));
    expect(sendInput()).toHaveValue("1234.56789012");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  it("the switch button swaps the tokens, clears the amount and never submits the form", async () => {
    const { backend, submit } = instantBackend();
    const user = await openForm({ backend });
    await user.type(sendInput(), "5");

    const flip = screen.getByRole("button", { name: "Swap sending and receiving tokens" });
    expect(flip).toHaveAttribute("type", "button");
    await user.click(flip);

    expect(screen.getByRole("combobox", { name: "Token to send" })).toHaveTextContent("bNEO");
    expect(screen.getByRole("combobox", { name: "Token to receive" })).toHaveTextContent("USD");
    expect(sendInput()).toHaveValue("");
    expect(submit).not.toHaveBeenCalled();
    expect(coins()).toEqual({ USD: "1800" });
  });

  it("stays available when the new sender has no balance, and says so instead of hiding", async () => {
    const user = await openForm();
    await user.click(screen.getByRole("button", { name: "Swap sending and receiving tokens" }));

    expect(
      screen.getByRole("button", { name: "Swap sending and receiving tokens" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("send-balance")).toHaveTextContent("Balance: 0 bNEO");
    await user.type(sendInput(), "1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Insufficient balance: 0 bNEO");
    expect(confirmButton()).toBeDisabled();
  });
});

describe("SwapForm — confirming a swap", () => {
  it("shows pending, then debits one token and credits the other by exactly the quote, with a toast", async () => {
    const { backend, submit, release } = manualBackend();
    const user = await openForm({ backend });
    await user.type(sendInput(), "3");
    await user.click(confirmButton());

    const pending = await screen.findByRole("button", { name: "Swapping…" });
    expect(pending).toHaveAttribute("aria-disabled", "true");
    expect(pending).toHaveAttribute("aria-busy", "true");
    expect(pending).toHaveFocus(); // the user's place is not lost
    expect(sendInput()).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Max" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Swap sending and receiving tokens" }),
    ).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Token to send" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Token to receive" })).toBeDisabled();
    expect(submit).toHaveBeenCalledWith(
      { from: "USD", to: "bNEO", amount: "3", receive: "1.5" },
      expect.anything(),
    );
    expect(coins()).toEqual({ USD: "1800" }); // nothing moves before the server says yes
    expect(screen.queryByText("Swap successful!")).not.toBeInTheDocument();

    release();
    expect(await screen.findByText("Swap successful!")).toBeInTheDocument();
    expect(screen.getByText("3 USD → 1.5 bNEO")).toBeInTheDocument();
    expect(coins()).toEqual({ USD: "1797", bNEO: "1.5" });
    expect(sendInput()).toHaveValue("");
    expect(screen.getByTestId("send-balance")).toHaveTextContent("Balance: 1,797 USD");
  });

  it("while pending: price refresh is locked, the wallet flag is raised, and both are released afterwards", async () => {
    const { backend, release } = manualBackend();
    const user = await openForm({ backend });
    await user.type(sendInput(), "3");
    expect(useWalletStore.getState().pendingSwap).toBe(false);
    await user.click(confirmButton());
    await screen.findByRole("button", { name: "Swapping…" });

    const refresh = within(screen.getByTestId("price-status")).getByRole("button");
    expect(refresh).toHaveAttribute("aria-disabled", "true");
    expect(useWalletStore.getState().pendingSwap).toBe(true);

    release();
    await screen.findByText("Swap successful!");
    expect(refresh).not.toHaveAttribute("aria-disabled", "true");
    expect(useWalletStore.getState().pendingSwap).toBe(false);
  });

  it("keyboard focus lands on the amount field after a successful swap instead of falling to the page", async () => {
    const user = await openForm();
    await user.type(sendInput(), "3");
    await user.click(confirmButton());
    await screen.findByText("Swap successful!");
    await waitFor(() => {
      expect(sendInput()).toHaveFocus();
    });
  });

  it("does not steal focus that the user has deliberately moved elsewhere", async () => {
    const { backend, release } = manualBackend();
    const user = await openForm({ backend });
    await user.type(sendInput(), "3");
    await user.click(confirmButton());
    await screen.findByRole("button", { name: "Swapping…" });
    // Max is locked while pending; the refresh link stays focusable, so the user can have moved there.
    const refresh = within(screen.getByTestId("price-status")).getByRole("button");
    refresh.focus();
    expect(refresh).toHaveFocus();

    release();
    await screen.findByText("Swap successful!");
    expect(refresh).toHaveFocus();
    expect(sendInput()).not.toHaveFocus();
  });

  it("credits exactly what the quote showed (regression: 14.02 shown, 14.03 credited)", async () => {
    const user = await openForm({
      records: feed(["USD", 1], ["bNEO", 7.1282679]),
      backend: instantBackend().backend,
    });
    await user.type(sendInput(), "100");
    const quoted = (receiveInput() as HTMLInputElement).value;
    expect(quoted).toBe("14.02865344");

    await user.click(confirmButton());
    await screen.findByText("Swap successful!");
    expect(coins().bNEO).toBe(quoted);
  });

  it("commits once even if submitted twice in a row (double click / double Enter)", async () => {
    const { backend, submit, release } = manualBackend();
    const user = await openForm({ backend });
    await user.type(sendInput(), "100");

    const form = sendInput().closest("form");
    if (form === null) throw new Error("form not found");
    fireEvent.submit(form);
    fireEvent.submit(form);
    await user.type(sendInput(), "{Enter}");
    expect(submit).toHaveBeenCalledTimes(1);

    release();
    await screen.findByText("Swap successful!");
    expect(coins()).toEqual({ USD: "1700", bNEO: "50" });
  });

  it("leaves the wallet untouched when the server refuses, and keeps the typed amount", async () => {
    const user = await openForm({ backend: instantBackend("reject").backend });
    await user.type(sendInput(), "3");
    await user.click(confirmButton());

    expect(
      await screen.findByText("Swap failed. Your balance was not changed."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Swap successful!")).not.toBeInTheDocument();
    expect(coins()).toEqual({ USD: "1800" });
    expect(sendInput()).toHaveValue("3");
    expect(confirmButton()).toBeEnabled();
  });

  it("re-checks the balance at commit time: spending it elsewhere while pending cannot make it negative", async () => {
    const { backend, release } = manualBackend();
    const user = await openForm({ backend });
    await user.type(sendInput(), "1000");
    await user.click(confirmButton());
    await screen.findByRole("button", { name: "Swapping…" });

    useWalletStore.setState({ coins: { USD: "10" } }); // e.g. another tab spent it
    release();

    expect(
      await screen.findByText("Swap failed. Your balance was not changed."),
    ).toBeInTheDocument();
    expect(coins()).toEqual({ USD: "10" });
  });

  it("spending the whole balance removes the empty token from the wallet", async () => {
    const user = await openForm();
    await user.click(screen.getByRole("button", { name: "Max" }));
    await user.click(confirmButton());
    await screen.findByText("Swap successful!");
    expect(coins()).toEqual({ bNEO: "900" });
  });
});

describe("SwapForm — price feed problems never produce a dead page", () => {
  it("falls back to clearly labelled sample prices when the feed answers with an error, and Retry recovers", async () => {
    let healthy = false;
    const fetchMock = stubFetch(() =>
      healthy ? jsonResponse(EASY_FEED) : new Response("not found", { status: 404 }),
    );
    const user = userEvent.setup();
    renderWithToaster(<SwapForm backend={instantBackend().backend} />);

    await screen.findByRole("heading", { name: "Swap" });
    const status = screen.getByTestId("price-status");
    expect(status).toHaveAttribute("data-source", "sample");
    expect(status).toHaveTextContent("Sample prices");
    expect(status).toHaveTextContent(
      "Live prices are unavailable (server error). These are sample prices, not real-time.",
    );
    expect(screen.queryByText(/Live prices ·/)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/500|Internal Server Error/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // a 404 is not retried

    // The form is still useful on sample prices.
    await user.type(sendInput(), "100");
    expect(receiveInput()).not.toHaveValue("");
    expect(confirmButton()).toBeEnabled();

    healthy = true;
    await user.click(within(status).getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(screen.getByTestId("price-status")).toHaveAttribute("data-source", "live");
    });
    expect(screen.getByTestId("price-status")).toHaveTextContent("Live prices");
    expect(receiveInput()).toHaveValue("50"); // recomputed from the live prices, typed amount kept
  });

  it("retries transient network failures, then shows sample prices naming the reason", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    vi.stubGlobal("fetch", fetchMock);
    renderWithToaster(<SwapForm backend={instantBackend().backend} />);

    await vi.advanceTimersByTimeAsync(2_000);
    await screen.findByRole("heading", { name: "Swap" });

    expect(fetchMock).toHaveBeenCalledTimes(3); // first attempt + 2 retries
    expect(screen.getByTestId("price-status")).toHaveTextContent(
      "Live prices are unavailable (network error)",
    );
  });

  it("times out a feed that never answers and falls back instead of hanging", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );
    renderWithToaster(<SwapForm backend={instantBackend().backend} />);

    await vi.advanceTimersByTimeAsync(40_000);
    await screen.findByRole("heading", { name: "Swap" });
    expect(screen.getByTestId("price-status")).toHaveTextContent("request timed out");
  });

  it.each([
    ["an empty list", []],
    ["an object instead of a list", { prices: [] }],
    ["only invalid records", [{ currency: "USD", price: -1, date: "2023-01-01T00:00:00Z" }]],
  ])("falls back to sample prices for %s", async (_label, payload) => {
    await openForm({ records: payload });
    expect(screen.getByTestId("price-status")).toHaveAttribute("data-source", "sample");
    expect(screen.getByTestId("price-status")).toHaveTextContent("unexpected data");
  });

  it("under React Strict Mode the cancelled first request is ignored and the form still ends up live", async () => {
    const fetchMock = stubFetch(() => jsonResponse(EASY_FEED));
    render(
      <StrictMode>
        <SwapForm backend={instantBackend().backend} />
      </StrictMode>,
    );
    await screen.findByRole("heading", { name: "Swap" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(usePriceStore.getState().source).toBe("live");
    expect(screen.getByTestId("price-status")).toHaveAttribute("data-source", "live");
  });
});
