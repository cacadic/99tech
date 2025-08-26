import { Button } from "@/shared/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { usePriceStore } from "@/shared/hooks/use-price-store";
import { useWalletStore, type Currency } from "@/shared/hooks/use-wallet-store";
import _ from "lodash";
import { ChevronDown, LucideWallet } from "lucide-react";
import { cloneElement, useState } from "react";

const WalletDetail = () => {
    const [open, setOpen] = useState(false);
    const prices = usePriceStore(s => s.prices);
    const coins: Record<Currency, string> = useWalletStore((s) => s.coins);

    const walletList = _.filter(prices, (item) => _.has(coins, item.currency));

    return (
        <div className="bg-blue-500 border-blue-200 border-2 rounded-md flex items-center gap-x-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild className="p-0 select-none">
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        asChild
                        className="!py-0 justify-between !bg-transparent border-0 hover:bg-transparent focus:ring-0"
                    >
                        <div className="flex">
                            <LucideWallet className="text-white" />
                            <span className="text-blue-base light:text-white">a86ef1</span>
                            <ChevronDown className="opacity-60 text-blue-base text-xs" />
                        </div>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                    <Command>
                        <CommandInput placeholder="Search coin..." className="h-9" />
                        <CommandList>
                            <CommandEmpty>No coin found.</CommandEmpty>
                            <CommandGroup>
                                {walletList?.map((coin) => (
                                    <CommandItem
                                        key={coin.currency}
                                        value={coin.currency}
                                        onSelect={() => {
                                            setOpen(false);
                                        }}
                                        asChild
                                    >
                                        <div className="flex justify-between w-full">
                                            <div className="flex gap-2 items-center cursor-pointer">
                                                {coin.icon && cloneElement(coin.icon, { className: "size-6" })}
                                                <span>
                                                    {coin.currency}
                                                </span>
                                            </div>

                                            <span className="text-xs text-muted-foreground">
                                                {coins[coin.currency]}
                                            </span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

        </div>
    );
};

export default WalletDetail;