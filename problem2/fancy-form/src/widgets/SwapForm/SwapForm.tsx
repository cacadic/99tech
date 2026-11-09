import { AlertCircleIcon, Loader2Icon, RefreshCcwIcon } from "lucide-react";
import { useEffect, useMemo, useRef, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  createMockSwapBackend,
  isFailureSimulated,
  type SwapBackend,
} from "@/shared/api/mockSwapBackend";
import { usePriceStore } from "@/shared/hooks/use-price-store";
import { CoinSelected } from "../CoinSelected";
import { CustomFormField } from "../CustomFormField";
import { LoadingScreen } from "../LoadingScreen";
import { PriceStatus } from "./PriceStatus";
import { useSwapForm } from "./useSwapForm";

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Alert id={id} variant="destructive" className="!gap-x-1.5 bg-red-600 py-2 [&>svg]:!text-white">
      <AlertCircleIcon aria-hidden="true" />
      <AlertTitle className="line-clamp-none whitespace-normal text-white">{children}</AlertTitle>
    </Alert>
  );
}

const blockClass =
  "flex w-full flex-col items-center justify-between gap-y-1.5 rounded-md border-0 bg-blue-200 p-3 light:bg-blue-100 sm:p-4";

function SwapCard({ backend: injected }: { backend?: SwapBackend }) {
  const { t } = useTranslation();
  const failureSimulated = isFailureSimulated(window.location.search);
  const defaultBackend = useMemo(
    () => createMockSwapBackend({ alwaysFail: failureSimulated }),
    [failureSimulated],
  );
  const amountRef = useRef<HTMLInputElement>(null);
  const form = useSwapForm(injected ?? defaultBackend, amountRef);

  const source = usePriceStore((s) => s.source);
  const asOf = usePriceStore((s) => s.asOf);
  const failure = usePriceStore((s) => s.failure);
  const loading = usePriceStore((s) => s.status === "loading");
  const load = usePriceStore((s) => s.load);

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void form.submit();
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="swap-title" className="w-full px-4">
      <div className="mx-auto flex w-full max-w-[400px] flex-col rounded-md bg-blue-500 px-4 pb-6 pt-7 sm:px-6 transition-all light:border light:border-accent light:bg-white light:shadow-md">
        <h1 id="swap-title" className="text-xl font-bold text-white light:text-blue-500">
          {t("swap")}
        </h1>

        <div className="mt-4">
          <div className={blockClass}>
            <div className="flex w-full items-center justify-between">
              <label
                htmlFor="amountToSend"
                className="text-base text-blue-label light:text-blue-500"
              >
                {t("amount_to_send")}
              </label>
              <button
                type="button"
                onClick={form.max}
                disabled={form.submitting}
                className="cursor-pointer select-none rounded px-1 text-base text-blue-label outline-none transition-all hover:text-white focus-visible:ring-[3px] focus-visible:ring-blue-base/70 active:text-blue-label light:text-blue-500 light:hover:text-blue-200 light:active:text-blue-base"
              >
                {t("max")}
              </button>
            </div>
            <div className="flex w-full items-center justify-between gap-2">
              <CoinSelected
                id="sendCoin"
                label={t("token_to_send")}
                value={form.from}
                onChange={form.setFrom}
                options={form.options}
                balances={form.balances}
                requireBalance
                disabled={form.submitting}
                describedBy={form.fromMessage === null ? undefined : "from-error"}
                invalid={form.fromMessage !== null}
              />
              <CustomFormField
                ref={amountRef}
                id="amountToSend"
                label={t("amount_to_send")}
                value={form.amountText}
                onChange={form.setAmountText}
                readOnly={form.submitting}
                invalid={form.amountMessage !== null}
                describedBy={form.amountMessage === null ? undefined : "send-error"}
              />
            </div>
            <div className="flex w-full items-center justify-between">
              <p className="text-base text-slate-300 light:text-slate-700">{t("value")}</p>
              <p className="text-base text-slate-300 light:text-slate-700" data-testid="send-usd">
                {form.sendUsd}
              </p>
            </div>
            {form.balanceText !== null && (
              <p
                className="w-full text-left text-sm text-slate-300 light:text-slate-700"
                data-testid="send-balance"
              >
                {t("balance", { amount: form.balanceText })}
              </p>
            )}
            {form.fromMessage !== null && (
              <FieldError id="from-error">{form.fromMessage}</FieldError>
            )}
            {form.amountMessage !== null && (
              <FieldError id="send-error">{form.amountMessage}</FieldError>
            )}
          </div>

          <div className="relative h-4">
            <Button
              size="icon"
              aria-label={t("switch_direction")}
              onClick={form.flip}
              disabled={form.submitting}
              className="absolute left-1/2 top-1/2 inline-flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-gray-900 shadow-none transition-all hover:bg-blue-200 focus:outline-none active:bg-blue-500 light:border-0 light:bg-blue-base light:shadow-md light:hover:bg-blue-500 light:active:bg-blue-base"
            >
              <RefreshCcwIcon className="text-white" aria-hidden="true" />
            </Button>
          </div>

          <div className={blockClass}>
            <div className="flex w-full items-center justify-between">
              <label
                htmlFor="amountToReceive"
                className="text-base text-blue-label light:text-blue-500"
              >
                {t("amount_to_receive")}
              </label>
            </div>
            <div className="flex w-full items-center justify-between gap-2">
              <CoinSelected
                id="receiveCoin"
                label={t("token_to_receive")}
                value={form.to}
                onChange={form.setTo}
                options={form.options}
                balances={form.balances}
                disabled={form.submitting}
                invalid={form.toMessage !== null}
                describedBy={form.toMessage === null ? undefined : "receive-error"}
              />
              <CustomFormField
                id="amountToReceive"
                label={t("amount_to_receive")}
                value={form.receiveText}
                readOnly
              />
            </div>
            <div className="flex w-full items-center justify-between">
              <p className="text-base text-slate-300 light:text-slate-700">{t("value")}</p>
              <p
                className="text-base text-slate-300 light:text-slate-700"
                data-testid="receive-usd"
              >
                {form.receiveUsd}
              </p>
            </div>
            {form.toMessage !== null && (
              <FieldError id="receive-error">{form.toMessage}</FieldError>
            )}
          </div>

          <p
            aria-live="polite"
            data-testid="rate"
            className="mt-3 min-h-5 text-center text-sm text-slate-300 light:text-slate-700"
          >
            {form.rateText}
          </p>
        </div>

        <Button
          type="submit"
          variant="destructive"
          // While pending the button stays focusable (aria-disabled) so keyboard and screen-reader users do not
          // lose their place; extra clicks / Enter presses are ignored by the submit guard.
          disabled={!form.canSubmit && !form.submitting}
          aria-disabled={form.submitting || undefined}
          aria-busy={form.submitting}
          className="mt-3 aria-disabled:cursor-wait aria-disabled:opacity-70 border border-transparent bg-blue-base hover:border-blue-base hover:bg-blue-200 active:bg-blue-500 disabled:cursor-not-allowed disabled:!pointer-events-auto disabled:hover:bg-blue-base light:bg-blue-500 light:hover:bg-blue-base light:active:bg-blue-200 light:disabled:bg-blue-base"
        >
          {form.submitting && <Loader2Icon className="animate-spin" aria-hidden="true" />}
          <span className="text-md">{form.submitting ? t("swapping") : t("confirm_swap")}</span>
        </Button>
        {form.formMessage !== null && <FieldError id="form-error">{form.formMessage}</FieldError>}

        <PriceStatus
          source={source}
          asOf={asOf}
          failure={failure}
          loading={loading}
          locked={form.submitting}
          onRetry={() => {
            void load();
          }}
        />
        <p className="mt-3 text-center text-xs text-slate-300 light:text-slate-700">
          {failureSimulated ? t("demo_failure_mode") : t("demo_notice")}
        </p>
      </div>
    </form>
  );
}

interface SwapFormProps {
  /** Replaces the simulated server (tests only; the app always uses the default). */
  backend?: SwapBackend;
}

const SwapForm = ({ backend }: SwapFormProps) => {
  const book = usePriceStore((s) => s.book);
  const load = usePriceStore((s) => s.load);
  const cancel = usePriceStore((s) => s.cancel);

  useEffect(() => {
    void load();
    // Cancelling on cleanup makes React Strict Mode's mount → unmount → mount issue exactly one live request.
    return cancel;
  }, [load, cancel]);

  // First load only: afterwards `book` stays set (live, or the labelled sample fallback) and the form is shown.
  if (book === null) return <LoadingScreen />;
  return <SwapCard backend={backend} />;
};

export default SwapForm;
