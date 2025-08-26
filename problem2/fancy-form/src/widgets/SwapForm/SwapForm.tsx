import type { PriceData, PricesResponse } from "@/shared/constants";
import { usePriceStore } from "@/shared/hooks/use-price-store";
import { iconMap } from "@/shared/lib/iconMap";
import { FormSchema, type FormValues } from "@/shared/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import _ from "lodash";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { CoinSelected } from "../CoinSelected";
import { CustomFormField } from "../CustomFormField";
import { AlertCircleIcon, Loader2Icon, RefreshCcwIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Form } from "@/shared/components/ui/form";
import { useWalletStore } from "@/shared/hooks/use-wallet-store";
import { Alert, AlertTitle } from "@/shared/components/ui/alert";
import { LoadingScreen } from "../LoadingScreen";
import { toast } from 'sonner';

const FETCH_URL = "https://interview.switcheo.com/prices.json";

const SwapForm = () => {
    const [isSwapping, setIsSwapping] = useState(false);
    const [isCannotFetch, setIsCannotFetch] = useState(false);
    const [isFetching, setIsFetching] = useState(false);

    const { setPrices } = usePriceStore();
    const prices = usePriceStore(s => s.prices);
    const coins = useWalletStore(s => s.coins);
    const swapWallet = useWalletStore(s => s.swap);

    const { t } = useTranslation();

    const form = useForm<FormValues>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            amountToSend: "0",
            amountToReceive: "0",
            sendCoin: "",
            receiveCoin: "",
        },
    });

    const errors = form.formState.errors;

    const amountToSend = form.watch("amountToSend");
    const amountToReceive = form.watch("amountToReceive");

    const fetchPrices = async () => {
        try {
            setIsFetching(true);
            const { data } = await axios.get<PriceData[]>(FETCH_URL)

            const dataWithIcons: PricesResponse = _(data)
                .groupBy("currency")
                .map((items) => _.maxBy(items, "price"))
                .compact()
                .map((item) => ({
                    ...item!,
                    icon: iconMap[item!.currency] ?? <span className="size-8">?</span>,
                }))
                .value()

            setPrices(dataWithIcons)
            const usd = dataWithIcons?.find(p => p.currency === "USD");

            form.setValue("sendCoin", usd?.currency || "")
            form.setValue("receiveCoin", dataWithIcons[1]?.currency || "")
            setIsCannotFetch(false);
        } catch (err) {
            console.error("Error fetching data:", err)
            setIsCannotFetch(true);
        } finally {
            setIsFetching(false);
        }
    }

    const sendCoin = form.watch("sendCoin");
    const receiveCoin = form.watch("receiveCoin");

    const sendCoinValue = useCallback(() => {
        const basePrice = prices.find(coin => coin.currency === sendCoin)?.price || 0;
        const value = Math.floor(basePrice * Number(amountToSend) * 100) / 100;
        return "$" + value;
    }, [prices, sendCoin, amountToSend]);

    const receiveCoinValue = useCallback(() => {
        const basePrice = prices.find(coin => coin.currency === receiveCoin)?.price || 0;
        const value = Math.floor(basePrice * Number(amountToReceive) * 100) / 100;
        return "$" + value;
    }, [prices, receiveCoin, amountToReceive]);

    const handleSwitchField = () => {
        const currentSendCoin = form.getValues("sendCoin")
        const currentReceiveCoin = form.getValues("receiveCoin")

        form.setValue("sendCoin", currentReceiveCoin)
        form.setValue("receiveCoin", currentSendCoin)

        form.setValue("amountToSend", "0")
        form.setValue("amountToReceive", "0")
    }

    const onMax = () => {
        const symbol = form.getValues("sendCoin");
        if (!symbol) return;
        const raw = coins?.[symbol] ?? "0";
        const value = Number(raw || 0).toFixed(2);
        form.setValue("amountToSend", value, { shouldValidate: true, shouldDirty: true });
    };

    const onSubmit = (values: FormValues) => {
        const sendPrice = prices.find(p => p.currency === values.sendCoin)?.price || 0;
        const receivePrice = prices.find(p => p.currency === values.receiveCoin)?.price || 0;

        if (!values.sendCoin || !values.receiveCoin) return;
        if (Number(values.amountToSend) <= 0) return;
        if (sendPrice <= 0 || receivePrice <= 0) return;

        const balance = Number(coins?.[values.sendCoin] ?? 0);
        const amountNum = Number(values.amountToSend);
        if (amountNum > balance) {
            const symbol = form.getValues("sendCoin");
            if (!symbol) return;
            const raw = coins?.[symbol] ?? "0";
            const value = Number(raw || 0).toFixed(2);
            form.setError("amountToSend", { type: "manual", message: "Insufficient balance: " + value });
            return;
        } else {
            form.clearErrors("amountToSend");
        }

        setIsSwapping(true);

        setTimeout(() => {
            swapWallet(values.sendCoin, values.receiveCoin, Number(values.amountToSend), sendPrice, receivePrice);

            form.reset({
                sendCoin: sendCoin,
                receiveCoin: receiveCoin,
                amountToSend: "0",
                amountToReceive: "0",
            });

            setIsSwapping(false);
            toast.success(t('swap_success'));
        }, 500);
    };

    useEffect(() => {
        const sendPrice = prices.find(p => p.currency === sendCoin)?.price || 0
        const receivePrice = prices.find(p => p.currency === receiveCoin)?.price || 0
        const amount = Number(amountToSend)

        if (sendPrice > 0 && receivePrice > 0 && amount > 0) {
            const amountReceive = (amount * sendPrice) / receivePrice
            const rounded = Math.floor(amountReceive * 100) / 100
            form.setValue("amountToReceive", rounded.toString())
        } else {
            form.setValue("amountToReceive", "0")
        }
    }, [amountToSend, sendCoin, receiveCoin, prices, form])

    useEffect(() => {
        if (amountToSend.length === 0) {
            form.setValue("amountToSend", "0");
        }
    }, [amountToSend, form])

    useEffect(() => {
        fetchPrices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (isFetching) {
        return (
            <LoadingScreen />
        )
    }

    if (isCannotFetch) {
        return (
            <section className="bg-white dark:bg-gray-900 w-full">
                <div className="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
                    <div className="mx-auto max-w-screen-sm text-center">
                        <h1 className="mb-4 text-7xl tracking-tight font-extrabold lg:text-9xl text-primary-600 dark:text-primary-500 light:text-white">500</h1>
                        <p className="mb-4 text-3xl tracking-tight font-bold text-gray-900 md:text-4xl dark:text-white">Internal Server Error.</p>
                        <p className="mb-4 text-lg font-light text-gray-500 dark:text-gray-400">We are already working to solve the problem. </p>
                    </div>
                </div>
            </section>
        )
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
                <div className="flex flex-col bg-blue-500 light:bg-white light:border-[1px] light:border-accent light:shadow-md px-6 pb-8 pt-7 rounded-md mx-auto max-w-[400px] w-full transition-all">
                    <h1 className="text-xl font-bold text-white light:text-blue-500">{t('swap')}</h1>
                    <div className="relative mt-4">
                        <div className="w-full mx-auto bg-blue-200 light:light:bg-blue-100 border-blue-200 light:border-blue-200 rounded-md flex flex-col justify-between items-center p-4  gap-y-1.5">
                            <div className="flex justify-between items-center w-full">
                                <p className="text-base text-blue-base light:text-blue-200">{t('amount_to_send')}</p>
                                <p className="text-base text-blue-base cursor-pointer hover:text-white transition-all select-none active:text-blue-base light:text-blue-500 light:hover:text-blue-200 light:active:text-blue-base" onClick={onMax}>
                                    {t('max')}
                                </p>
                            </div>
                            <div className="flex justify-between items-center w-full">
                                <CoinSelected name="sendCoin" isSend />
                                <CustomFormField name="amountToSend" />
                            </div>
                            <div className="flex justify-between items-center w-full">
                                <p className="text-base text-gray-400 light:text-blue-base">{t('value')}</p>
                                <p className="text-base text-gray-400">{sendCoinValue()}</p>
                            </div>
                        </div>

                        <div className="w-full mx-auto bg-blue-200 light:bg-blue-100 border-blue-200 border-0 rounded-md flex flex-col justify-between items-center p-4 mt-4 gap-y-1.5">
                            <div className="flex justify-between items-center w-full">
                                <p className="text-base text-blue-base light:text-blue-200">{t('amount_to_receive')}</p>
                            </div>
                            <div className="flex justify-between items-center w-full">
                                <CoinSelected name="receiveCoin" />
                                <CustomFormField name="amountToReceive" disabled />
                            </div>
                            <div className="flex justify-between items-center w-full">
                                <p className="text-base text-gray-400 light:text-blue-base">{t('value')}</p>
                                <p className="text-base text-gray-400">{receiveCoinValue()}</p>
                            </div>
                        </div>
                        {coins?.[receiveCoin] && form.getValues("sendCoin") !== form.getValues("receiveCoin") && (
                            <Button
                                size="icon"
                                className="inline-flex size-10 items-center justify-center rounded-full bg-gray-900 transition-all hover:bg-blue-200 focus:outline-none absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 active:bg-blue-500 light:bg-blue-base light:border-blue-200 light:border-0 border-[1px] light:active:bg-blue-base light:shadow-md"
                                onClick={handleSwitchField}
                            >
                                <RefreshCcwIcon className="text-white hover:text-blue-200" />
                            </Button>
                        )}
                    </div>
                    <Button type="submit" variant="destructive"
                        className="mt-4 bg-blue-base hover:bg-blue-200 hover:border-blue-base active:bg-blue-500 border-[1px] border-transparent disabled:cursor-not-allowed disabled:!pointer-events-auto disabled:hover:bg-blue-base light:disabled:bg-blue-base light:bg-blue-500 light:hover:bg-blue-base light:active:bg-blue-200"
                        disabled={isSwapping || !form.formState.isValid || form.getValues("sendCoin") === form.getValues("receiveCoin") || Number(form.getValues("amountToSend")) <= 0}>
                        {isSwapping && <Loader2Icon className="animate-spin" />}
                        <span className="text-md">{t('confirm_swap')}</span>
                    </Button>

                    {errors?.amountToSend && (
                        <Alert variant="destructive" className="mt-4 bg-red-500 py-2.5 [&>svg]:!text-white !gap-x-1.5">
                            <AlertCircleIcon />
                            <AlertTitle className="text-white">{errors.amountToSend?.message}</AlertTitle>
                        </Alert>
                    )}
                </div>
            </form>
        </Form>
    );
};

export default SwapForm;