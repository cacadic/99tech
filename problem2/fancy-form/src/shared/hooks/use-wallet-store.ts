import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { D } from "@/domain/decimal";
import { applyMockSwap, balanceOf, type Balances, type MockSwapResult } from "@/domain/swap";
import { DEFAULT_BALANCES, sanitizeBalances } from "@/domain/wallet";
import { createTrackedStorage } from "@/shared/lib/trackedStorage";

export type Currency = string;

export interface CommitSwapRequest {
  readonly from: Currency;
  readonly to: Currency;
  /** Plain decimal strings. */
  readonly amount: string;
  readonly receive: string;
}

interface WalletState {
  coins: Balances;
  /**
   * Debits `from` and credits `to` in a single state update, re-checking the balance at this moment.
   * Returns `{ ok: false }` and changes nothing when the swap cannot be applied.
   */
  commitSwap: (request: CommitSwapRequest) => MockSwapResult;
  getCoin: (currency: Currency) => string;
  reset: () => void;
  /** True while a swap request is in flight (not persisted); used to lock Reset and price refresh. */
  pendingSwap: boolean;
  setPendingSwap: (pending: boolean) => void;
}

const restore = (persisted: unknown): Balances | null =>
  sanitizeBalances((persisted as { coins?: unknown } | null | undefined)?.coins);

export const WALLET_STORAGE_KEY = "wallet-storage";

const walletStorage = createTrackedStorage();

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      coins: DEFAULT_BALANCES,
      commitSwap: ({ from, to, amount, receive }) => {
        // Another tab may have spent the money since this tab last looked: catch up before checking the balance.
        if (walletStorage.changedElsewhere(WALLET_STORAGE_KEY)) {
          void useWalletStore.persist.rehydrate();
        }
        let result = { ok: false, code: "invalid_request" } as MockSwapResult;
        set((state) => {
          try {
            result = applyMockSwap(state.coins, {
              from,
              to,
              amount: new D(amount),
              receive: new D(receive),
            });
          } catch {
            result = { ok: false, code: "invalid_request" };
          }
          return result.ok ? { coins: result.balances } : state;
        });
        return result;
      },
      getCoin: (currency) => balanceOf(get().coins, currency).toFixed(),
      reset: () => {
        set({ coins: DEFAULT_BALANCES });
      },
      pendingSwap: false,
      setPendingSwap: (pendingSwap) => {
        set({ pendingSwap });
      },
    }),
    {
      name: WALLET_STORAGE_KEY,
      // v0 (original Fancy Form) stored 2-decimal strings such as "1700.00"; v1 stores normalised decimals.
      version: 1,
      storage: createJSONStorage(() => walletStorage),
      partialize: (state) => ({ coins: state.coins }),
      migrate: (persisted) => ({ coins: restore(persisted) ?? DEFAULT_BALANCES }),
      // Also guards against a hand-edited or corrupted entry of the current version.
      merge: (persisted, current) => ({ ...current, coins: restore(persisted) ?? current.coins }),
    },
  ),
);

// Keep every open tab in step with the saved wallet.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === WALLET_STORAGE_KEY || event.key === null)
      void useWalletStore.persist.rehydrate();
  });
}
