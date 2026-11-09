import { create } from "zustand";
import {
  normalizePriceData,
  type NormalizedPrices,
  type PriceBook,
  type PriceEntry,
} from "@/domain/prices";
import {
  isAbortError,
  loadLivePrices,
  PriceFetchError,
  type LoadLivePricesOptions,
} from "@/shared/api/prices";
import { SAMPLE_PRICE_RECORDS } from "@/shared/constants/samplePrices";

export type PriceSource = "live" | "sample";

interface PriceState {
  /** `loading` can coexist with already-loaded prices (a refresh). */
  status: "idle" | "loading" | "ready";
  /** Where the current prices come from. `sample` is the labelled offline fallback. */
  source: PriceSource | null;
  entries: readonly PriceEntry[];
  book: PriceBook | null;
  /** Timestamp of the newest price in use (ISO). */
  asOf: string | null;
  /** Why the live feed could not be used, when `source === "sample"`. */
  failure: PriceFetchError | null;
  load: (options?: LoadLivePricesOptions) => Promise<void>;
  cancel: () => void;
}

let inFlight: AbortController | null = null;

const applyPrices = (prices: NormalizedPrices) => ({
  entries: prices.entries,
  book: prices.book,
  asOf: prices.asOf,
});

export const usePriceStore = create<PriceState>()((set) => ({
  status: "idle",
  source: null,
  entries: [],
  book: null,
  asOf: null,
  failure: null,

  load: async (options) => {
    inFlight?.abort();
    const mine = new AbortController();
    inFlight = mine;
    set({ status: "loading" });

    try {
      const prices = await loadLivePrices({ ...options, signal: mine.signal });
      if (mine.signal.aborted) return;
      set({ status: "ready", source: "live", failure: null, ...applyPrices(prices) });
    } catch (error) {
      // A cancelled or superseded request must not touch the state (React Strict Mode mounts twice).
      if (mine.signal.aborted || isAbortError(error)) return;
      const failure =
        error instanceof PriceFetchError
          ? error
          : new PriceFetchError("network", "Unexpected error");
      set({
        status: "ready",
        source: "sample",
        failure,
        ...applyPrices(normalizePriceData(SAMPLE_PRICE_RECORDS)),
      });
    } finally {
      if (inFlight === mine) inFlight = null;
    }
  },

  cancel: () => {
    inFlight?.abort();
    inFlight = null;
  },
}));
