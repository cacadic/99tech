import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const DEFAULT_BALANCE = "1800";

export type Currency = string;

interface WalletState {
  coins: Record<Currency, string>;
  swap: (
    from: Currency,
    to: Currency,
    amount: number,
    priceFrom: number,
    priceTo: number
  ) => void;
  getCoin: (currency: Currency) => string;
}

const addDec = (a: string, b: string) => (Number(a) + Number(b)).toFixed(2);
const subDec = (a: string, b: string) => (Number(a) - Number(b)).toFixed(2);

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      coins: { USD: DEFAULT_BALANCE },
      swap: (from, to, amount, priceFrom, priceTo) => {
        const balances = get().coins;
        const fromBalNum = Number(balances[from] ?? "0");

        if (
          amount <= 0 ||
          amount > fromBalNum ||
          priceFrom <= 0 ||
          priceTo <= 0
        )
          return;

        const usdValue = amount * priceFrom;
        const toAmount = (usdValue / priceTo).toFixed(2);

        const newFrom = subDec(balances[from] ?? "0", amount.toString());

        const next: Record<string, string> = { ...balances };

        if (Number(newFrom) <= 0) {
          delete next[from];
        } else {
          next[from] = newFrom;
        }

        const prevTo = next[to] ?? "0";
        next[to] = addDec(prevTo, toAmount);

        set({ coins: next });
      },
      getCoin: (currency) => get().coins[currency] ?? 0,
    }),
    {
      name: "wallet-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
