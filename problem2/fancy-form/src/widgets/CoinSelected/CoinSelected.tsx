import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatAmount } from "@/domain/decimal";
import type { PriceEntry } from "@/domain/prices";
import { balanceOf, type Balances } from "@/domain/swap";
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
import { cn } from "@/shared/lib/utils";

interface CoinSelectedProps {
  id: string;
  /** Accessible name of the trigger, e.g. "Token to send". */
  label: string;
  value: string | null;
  onChange: (symbol: string) => void;
  /** Only tokens that have a valid price are ever passed in. */
  options: readonly PriceEntry[];
  balances: Balances;
  /** Sender mode: tokens the wallet does not hold stay visible but cannot be picked. */
  requireBalance?: boolean;
  /** Describes what the trigger is associated with (e.g. a validation message). */
  describedBy?: string;
  invalid?: boolean;
  /** Locks the control (a swap is pending). */
  disabled?: boolean;
}

const CoinSelected = ({
  id,
  label,
  value,
  onChange,
  options,
  balances,
  requireBalance = false,
  describedBy,
  invalid = false,
  disabled = false,
}: CoinSelectedProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${id}-list`}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className="flex h-10 min-w-[110px] max-w-[160px] cursor-pointer select-none items-center disabled:cursor-wait disabled:opacity-60 justify-between gap-x-2 rounded-md bg-transparent text-left outline-none focus-visible:ring-[3px] focus-visible:ring-blue-base/70"
        >
          <span className="flex min-w-0 items-center gap-x-2">
            {value !== null && <TokenIcon symbol={value} />}
            <span className="truncate text-xl text-white light:text-blue-500">{value ?? "—"}</span>
          </span>
          <ChevronDown
            className="shrink-0 text-white opacity-60 light:text-blue-200"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start" aria-label={label}>
        <Command label={t("search_coin")}>
          <CommandInput
            placeholder={t("search_coin")}
            aria-label={t("search_coin")}
            className="h-9"
          />
          <CommandList id={`${id}-list`}>
            <CommandEmpty>{t("no_coin_found")}</CommandEmpty>
            <CommandGroup>
              {options.map((coin) => {
                const balance = balanceOf(balances, coin.currency);
                const unavailable = requireBalance && balance.lte(0);
                return (
                  <CommandItem
                    key={coin.currency}
                    value={coin.currency}
                    disabled={unavailable}
                    onSelect={() => {
                      onChange(coin.currency);
                      setOpen(false);
                    }}
                  >
                    <TokenIcon symbol={coin.currency} className="size-6" />
                    <span className="truncate">{coin.currency}</span>
                    {requireBalance && (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {unavailable ? t("no_balance") : formatAmount(balance)}
                      </span>
                    )}
                    <Check
                      aria-hidden="true"
                      className={cn(
                        "shrink-0",
                        requireBalance ? "" : "ml-auto",
                        value === coin.currency ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CoinSelected;
