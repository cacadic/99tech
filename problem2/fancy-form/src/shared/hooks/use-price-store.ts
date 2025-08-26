import { create } from "zustand";
import type { PricesResponse } from "@/shared/constants";

interface Wallet {
  currency: string;
  balance: number;
}

interface PriceStore {
  prices: PricesResponse;
  wallet: Wallet[];

  setPrices: (prices: PricesResponse) => void;
  addWallet: (wallet: Wallet) => void;
  updateWallet: (currency: string, balance: number) => void;
  reset: () => void;
}

export const usePriceStore = create<PriceStore>((set) => ({
  prices: [],
  wallet: [],
  setPrices: (prices) => set({ prices }),
  addWallet: (wallet) =>
    set((state) => ({ wallet: [...state.wallet, wallet] })),
  updateWallet: (currency, balance) =>
    set((state) => ({
      wallet: state.wallet.map((w) =>
        w.currency === currency ? { ...w, balance } : w
      ),
    })),
  reset: () =>
    set({
      prices: [],
      wallet: [],
    }),
}));
