import { Button } from "@/shared/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { cloneElement, useState } from "react";
import { FormField, FormItem } from "@/shared/components/ui/form";
import { useFormContext, type Path } from "react-hook-form";
import type { FormSchemaData, FormValues } from "@/shared/schemas";
import { usePriceStore } from "@/shared/hooks/use-price-store";
import { useWalletStore } from "@/shared/hooks/use-wallet-store";
import _ from "lodash";

interface CoinSelectedProps {
    name: Path<FormSchemaData>;
    isSend?: boolean;
}

const CoinSelected = ({ name, isSend }: CoinSelectedProps) => {
    const [open, setOpen] = useState(false);

    const form = useFormContext<FormValues>();

    const prices = usePriceStore(s => s.prices);
    const coins = useWalletStore(s => s.coins);

    const walletList = _.filter(prices, (item) => _.has(coins, item.currency));
    const optionsList = isSend ? walletList : prices;

    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => {
                const selectedCoin = prices.find((coin) => coin.currency === field.value);

                return (
                    <FormItem>
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild className="p-0 select-none">
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    asChild
                                    className="w-[110px] !p-0 justify-between !bg-transparent !shadow-none border-0 hover:bg-transparent focus:ring-0"
                                >
                                    <div className="flex">
                                        <div className="flex gap-x-2 items-center">
                                            {selectedCoin?.icon}
                                            <span className="text-white uppercase text-xl light:text-blue-500">
                                                {selectedCoin?.currency}
                                            </span>
                                        </div>

                                        <ChevronDown className="opacity-60 text-white light:text-blue-200" />
                                    </div>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0">
                                <Command>
                                    <CommandInput placeholder="Search coin..." className="h-9" />
                                    <CommandList>
                                        <CommandEmpty>No coin found.</CommandEmpty>
                                        <CommandGroup>
                                            {optionsList?.map((coin) => (
                                                <CommandItem
                                                    key={coin.currency}
                                                    value={coin.currency}
                                                    onSelect={(currentValue) => {
                                                        form.setValue(field.name, currentValue === field.value ? "" : currentValue);
                                                        form.setValue("amountToSend", "0");
                                                        form.setValue("amountToReceive", "0");
                                                        setOpen(false);
                                                    }}
                                                    asChild
                                                >
                                                    <div className="flex gap-2 items-center cursor-pointer">
                                                        {coin.icon && cloneElement(coin.icon, { className: "size-6" })}
                                                        <span>
                                                            {coin.currency}
                                                        </span>
                                                        <Check
                                                            className={cn(
                                                                "ml-auto",
                                                                field.value === coin.currency ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </FormItem>
                )
            }}
        />
    );
};

export default CoinSelected;