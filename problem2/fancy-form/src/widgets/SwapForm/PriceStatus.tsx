import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PriceFetchError } from "@/shared/api/prices";
import type { PriceSource } from "@/shared/hooks/use-price-store";
import { currentLanguage } from "@/shared/config/i18n/i18n";

interface PriceStatusProps {
  source: PriceSource | null;
  asOf: string | null;
  failure: PriceFetchError | null;
  loading: boolean;
  /** A swap is pending: refreshing now would change the quote under the user's feet. */
  locked?: boolean;
  onRetry: () => void;
}

/**
 * Always tells the user where the numbers come from. Sample prices are never presented as live.
 */
export function PriceStatus({
  source,
  asOf,
  failure,
  loading,
  locked = false,
  onRetry,
}: PriceStatusProps) {
  const busy = loading || locked;
  const { t } = useTranslation();
  const isSample = source === "sample";
  const date =
    asOf === null
      ? null
      : new Intl.DateTimeFormat(currentLanguage(), { dateStyle: "medium", timeZone: "UTC" }).format(
          new Date(asOf),
        );

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="price-status"
      data-source={source ?? "none"}
      className="mt-4 flex flex-col gap-1.5 text-sm text-slate-300 light:text-slate-700"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className={
              isSample
                ? "size-2 shrink-0 rounded-full bg-amber-400"
                : "size-2 shrink-0 rounded-full bg-emerald-400"
            }
          />
          <span>
            {isSample ? t("prices_sample") : t("prices_live")}
            {date !== null && ` · ${t("prices_as_of", { date })}`}
          </span>
        </span>
        <button
          type="button"
          // aria-disabled, not disabled: the button keeps keyboard focus while it is busy.
          onClick={() => {
            if (!busy) onRetry();
          }}
          aria-disabled={busy || undefined}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded text-blue-base underline underline-offset-2 outline-none hover:text-white focus-visible:ring-[3px] focus-visible:ring-blue-base/70 aria-disabled:cursor-wait aria-disabled:no-underline aria-disabled:opacity-70 light:text-blue-500 light:hover:text-blue-200"
        >
          {loading && <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />}
          {loading ? t("retrying") : isSample ? t("retry") : t("refresh_prices")}
        </button>
      </div>
      {isSample && failure !== null && (
        <p className="text-amber-300 light:text-amber-800">
          {t("prices_sample_note", { reason: t(`prices_reason_${failure.kind}`) })}
        </p>
      )}
    </div>
  );
}
