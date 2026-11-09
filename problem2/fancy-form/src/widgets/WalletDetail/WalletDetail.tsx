import { ChevronDown, LucideWallet } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { D, formatAmount } from "@/domain/decimal";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { TokenIcon } from "@/shared/components/TokenIcon";
import { usePriceStore } from "@/shared/hooks/use-price-store";
import { useWalletStore } from "@/shared/hooks/use-wallet-store";

/** Fixed, made-up address: there is no real wallet connection in this demo. */
const DEMO_ADDRESS = "a86ef1";

const WalletDetail = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const entries = usePriceStore((s) => s.entries);
  const coins = useWalletStore((s) => s.coins);
  const reset = useWalletStore((s) => s.reset);
  const pendingSwap = useWalletStore((s) => s.pendingSwap);

  // Listed from the wallet itself, so a balance never disappears just because its price is missing.
  const held = useMemo(() => {
    const feedOrder = entries
      .map((entry) => entry.currency)
      .filter((symbol) => Object.hasOwn(coins, symbol));
    const others = Object.keys(coins)
      .filter((symbol) => !feedOrder.includes(symbol))
      .sort();
    return [...feedOrder, ...others];
  }, [entries, coins]);

  return (
    <div className="flex h-10 items-center rounded-md border-2 border-blue-200 bg-blue-500">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("wallet_aria", { address: DEMO_ADDRESS })}
            aria-expanded={open}
            aria-haspopup="dialog"
            className="flex h-full cursor-pointer select-none items-center gap-x-2 rounded-md px-3 outline-none focus-visible:ring-[3px] focus-visible:ring-blue-base/70"
          >
            <LucideWallet className="size-4 text-white" aria-hidden="true" />
            <span className="text-sm font-medium text-blue-base light:text-white">
              {DEMO_ADDRESS}
            </span>
            <ChevronDown
              className="size-4 text-blue-base opacity-80 light:text-white"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0" align="end" aria-label={t("wallet")}>
          <Command label={t("search_coin")}>
            <CommandInput
              placeholder={t("search_coin")}
              aria-label={t("search_coin")}
              className="h-9"
            />
            <CommandList>
              <CommandEmpty>{t("no_coin_found")}</CommandEmpty>
              <CommandGroup heading={t("wallet")}>
                {held.map((symbol) => (
                  <CommandItem
                    key={symbol}
                    value={symbol}
                    onSelect={() => {
                      setOpen(false);
                    }}
                  >
                    <TokenIcon symbol={symbol} className="size-6" />
                    <span className="truncate">{symbol}</span>
                    <span
                      className="ml-auto shrink-0 text-xs text-muted-foreground"
                      data-testid={`balance-${symbol}`}
                    >
                      {formatAmount(new D(coins[symbol] ?? 0))}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="flex items-center justify-between gap-2 border-t p-2">
            <p className="text-xs text-muted-foreground">{t("wallet_note")}</p>
            <button
              type="button"
              onClick={reset}
              disabled={pendingSwap}
              className="shrink-0 cursor-pointer rounded text-xs underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50 underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
            >
              {t("wallet_reset")}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default WalletDetail;
