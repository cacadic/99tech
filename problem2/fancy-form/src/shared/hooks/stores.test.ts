import { describe, expect, it, vi } from "vitest";
import { SAMPLE_PRICE_RECORDS } from "@/shared/constants/samplePrices";
import { EASY_FEED, jsonResponse, stubFetch } from "@/test/helpers";
import { usePriceStore } from "./use-price-store";
import { useWalletStore, WALLET_STORAGE_KEY } from "./use-wallet-store";

describe("wallet store", () => {
  const swap = { from: "USD", to: "bNEO", amount: "100", receive: "14.02865344" };

  it("starts with 1800 USD", () => {
    expect(useWalletStore.getState().coins).toEqual({ USD: "1800" });
    expect(useWalletStore.getState().getCoin("USD")).toBe("1800");
    expect(useWalletStore.getState().getCoin("ETH")).toBe("0"); // always a string, never the number 0
  });

  it("commitSwap debits and credits in one update", () => {
    const seen: string[] = [];
    const unsubscribe = useWalletStore.subscribe((state) => seen.push(JSON.stringify(state.coins)));

    expect(useWalletStore.getState().commitSwap(swap).ok).toBe(true);
    unsubscribe();

    expect(useWalletStore.getState().coins).toEqual({ USD: "1700", bNEO: "14.02865344" });
    // One state change in total: no observer ever sees "debited but not yet credited".
    expect(seen).toEqual([JSON.stringify({ USD: "1700", bNEO: "14.02865344" })]);
  });

  it("a second identical commit that would overspend is refused and changes nothing", () => {
    const big = { ...swap, amount: "1000", receive: "140" };
    expect(useWalletStore.getState().commitSwap(big).ok).toBe(true);
    const before = useWalletStore.getState().coins;

    expect(useWalletStore.getState().commitSwap(big)).toEqual({
      ok: false,
      code: "insufficient_balance",
    });
    expect(useWalletStore.getState().coins).toBe(before);
    expect(useWalletStore.getState().coins).toEqual({ USD: "800", bNEO: "140" });
  });

  it("rejects malformed input without throwing or changing the wallet", () => {
    for (const bad of [
      { ...swap, amount: "abc" },
      { ...swap, receive: "" },
      { ...swap, to: "USD" },
    ]) {
      expect(useWalletStore.getState().commitSwap(bad)).toEqual({
        ok: false,
        code: "invalid_request",
      });
    }
    expect(useWalletStore.getState().coins).toEqual({ USD: "1800" });
  });

  it("persists under the original key and survives a reload", async () => {
    useWalletStore.getState().commitSwap(swap);
    const stored = JSON.parse(localStorage.getItem(WALLET_STORAGE_KEY) ?? "null") as {
      state: { coins: unknown };
      version: number;
    };
    expect(stored.state.coins).toEqual({ USD: "1700", bNEO: "14.02865344" });
    expect(stored.version).toBe(1);

    useWalletStore.setState({ coins: { USD: "1" } }, false); // pretend the page was reloaded with stale memory
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(stored));
    await useWalletStore.persist.rehydrate();
    expect(useWalletStore.getState().coins).toEqual({ USD: "1700", bNEO: "14.02865344" });
  });

  it("migrates the original (version 0, 2-decimal strings) storage format", async () => {
    localStorage.setItem(
      WALLET_STORAGE_KEY,
      JSON.stringify({ state: { coins: { USD: "1700.00", bNEO: "14.03" } }, version: 0 }),
    );
    await useWalletStore.persist.rehydrate();
    expect(useWalletStore.getState().coins).toEqual({ USD: "1700", bNEO: "14.03" });
  });

  describe("a freshly loaded page (new module instance) reading the saved wallet", () => {
    const load = async () => {
      vi.resetModules();
      return (await import("./use-wallet-store")).useWalletStore;
    };

    it("restores a valid saved wallet", async () => {
      localStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({ state: { coins: { ETH: "2" } }, version: 1 }),
      );
      expect((await load()).getState().coins).toEqual({ ETH: "2" });
    });

    it.each([
      [
        "negative and garbage values",
        JSON.stringify({ state: { coins: { USD: "-5", ETH: "lots" } }, version: 1 }),
      ],
      ["an array", JSON.stringify({ state: { coins: ["USD"] }, version: 1 })],
      ["no coins", JSON.stringify({ state: { coins: {} }, version: 1 })],
      ["text that is not JSON", "{{{"],
    ])("starts from the default wallet when storage holds %s", async (_label, raw) => {
      localStorage.setItem(WALLET_STORAGE_KEY, raw);
      expect((await load()).getState().coins).toEqual({ USD: "1800" });
    });
  });

  it("reset restores 1800 USD", () => {
    useWalletStore.setState({ coins: { ETH: "3" } });
    useWalletStore.getState().reset();
    expect(useWalletStore.getState().coins).toEqual({ USD: "1800" });
  });
});

describe("wallet store — storage problems", () => {
  const swap = { from: "USD", to: "bNEO", amount: "100", receive: "14.02865344" };
  const otherTabWrites = (coins: Record<string, string>) => {
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ state: { coins }, version: 1 }));
  };

  it("another tab spending the money first makes this tab refuse (no cross-tab double spend)", () => {
    otherTabWrites({ ETH: "1" }); // the other tab swapped all the USD for ETH

    const result = useWalletStore
      .getState()
      .commitSwap({ ...swap, amount: "1800", receive: "252" });

    expect(result).toEqual({ ok: false, code: "insufficient_balance" });
    expect(useWalletStore.getState().coins).toEqual({ ETH: "1" }); // and it caught up with the other tab
  });

  it("a `storage` event from another tab updates this tab's wallet immediately", () => {
    otherTabWrites({ ETH: "1", USD: "5" });
    window.dispatchEvent(new StorageEvent("storage", { key: WALLET_STORAGE_KEY }));
    expect(useWalletStore.getState().coins).toEqual({ ETH: "1", USD: "5" });
  });

  it("ignores `storage` events for unrelated keys", () => {
    otherTabWrites({ ETH: "1" });
    window.dispatchEvent(new StorageEvent("storage", { key: "theme" }));
    expect(useWalletStore.getState().coins).toEqual({ USD: "1800" });
  });

  it("a failing localStorage write (quota, blocked) does not make a committed swap look failed", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });

    const result = useWalletStore.getState().commitSwap(swap);

    expect(result.ok).toBe(true);
    expect(useWalletStore.getState().coins).toEqual({ USD: "1700", bNEO: "14.02865344" });
  });

  it("and a later swap does not roll back to the stale saved wallet", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    useWalletStore.getState().commitSwap(swap);
    const second = useWalletStore
      .getState()
      .commitSwap({ ...swap, amount: "1000", receive: "140" });

    expect(second.ok).toBe(true);
    expect(useWalletStore.getState().coins).toEqual({ USD: "700", bNEO: "154.02865344" });
  });

  it("an unreadable localStorage does not break the store", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.resetModules();
    const fresh = (await import("./use-wallet-store")).useWalletStore;
    expect(fresh.getState().coins).toEqual({ USD: "1800" });
    expect(fresh.getState().commitSwap(swap).ok).toBe(true);
  });
});

describe("price store", () => {
  it("loads live prices", async () => {
    stubFetch(() => jsonResponse(EASY_FEED));
    await usePriceStore.getState().load();
    const state = usePriceStore.getState();
    expect(state.status).toBe("ready");
    expect(state.source).toBe("live");
    expect(state.failure).toBeNull();
    expect(state.entries.map((e) => e.currency)).toEqual(["USD", "bNEO", "ETH"]);
  });

  it("uses the labelled sample prices when the feed fails, and records why", async () => {
    stubFetch(() => new Response("", { status: 404 }));
    await usePriceStore.getState().load();
    const state = usePriceStore.getState();
    expect(state.source).toBe("sample");
    expect(state.failure?.kind).toBe("http");
    expect(state.entries).toHaveLength(32);
    expect(SAMPLE_PRICE_RECORDS).toHaveLength(36);
  });

  it("a newer load supersedes an older one: the stale response cannot overwrite the new state", async () => {
    let calls = 0;
    const resolvers: ((r: Response) => void)[] = [];
    vi.stubGlobal("fetch", () => {
      calls += 1;
      return new Promise<Response>((resolve, reject) => {
        resolvers.push(resolve);
        // The first request is aborted by the second load.
        if (calls === 1) setTimeout(() => reject(new DOMException("Aborted", "AbortError")), 0);
      });
    });

    const first = usePriceStore.getState().load();
    const second = usePriceStore.getState().load();
    resolvers[1]?.(jsonResponse(EASY_FEED));
    await Promise.all([first, second]);

    expect(usePriceStore.getState().source).toBe("live");
    expect(usePriceStore.getState().entries).toHaveLength(3);
  });

  it("cancel() leaves the state alone", async () => {
    vi.stubGlobal(
      "fetch",
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const pending = usePriceStore.getState().load();
    usePriceStore.getState().cancel();
    await pending;
    expect(usePriceStore.getState().source).toBeNull();
    expect(usePriceStore.getState().entries).toEqual([]);
  });
});
