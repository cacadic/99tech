import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  D,
  formatAmount,
  formatDecimal,
  formatRate,
  formatUsd,
  parseAmount,
} from "@/domain/decimal";
import {
  balanceOf,
  defaultPair,
  validateSwap,
  type SwapField,
  type SwapIssue,
} from "@/domain/swap";
import type { SwapBackend } from "@/shared/api/mockSwapBackend";
import { usePriceStore } from "@/shared/hooks/use-price-store";
import { useWalletStore } from "@/shared/hooks/use-wallet-store";

/**
 * All swap-form behaviour. The only state kept is what the user chose (two tokens and the typed amount);
 * quote, USD values, rate and validation messages are derived from it on every render, so they can never
 * drift out of sync the way effect-synchronised form state did.
 */
export function useSwapForm(backend: SwapBackend, amountRef: RefObject<HTMLInputElement | null>) {
  const { t } = useTranslation();
  const entries = usePriceStore((s) => s.entries);
  const book = usePriceStore((s) => s.book);
  const priceStatus = usePriceStore((s) => s.status);
  const coins = useWalletStore((s) => s.coins);
  const commitSwap = useWalletStore((s) => s.commitSwap);
  const setPendingSwap = useWalletStore((s) => s.setPendingSwap);

  // Chosen once, when the form first has prices; after that only the user changes the pair.
  const [selection, setSelection] = useState(() => defaultPair(entries, coins));
  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const refocusAmount = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const { from, to } = selection;

  const validation = useMemo(
    () => validateSwap({ amountText, from, to, prices: book, balances: coins }),
    [amountText, from, to, book, coins],
  );
  const { quote } = validation;
  const canSubmit = validation.ok && priceStatus === "ready" && !submitting;

  const describe = useCallback(
    (issue: SwapIssue): string => {
      if (issue.code === "insufficient_balance") {
        const balance = formatAmount(new D(issue.params?.balance ?? "0"));
        return t("insufficient_balance", {
          amount: `${balance} ${issue.params?.symbol ?? ""}`.trim(),
        });
      }
      return t(`err_${issue.code}`, { ...issue.params });
    },
    [t],
  );

  // Amount problems stay quiet until the user has typed something (the disabled Confirm button covers the empty field).
  const showAmountIssues = amountText.trim() !== "";
  const messageFor = (field: SwapField): string | null => {
    const issue = validation.issues.find(
      (i) => i.field === field && (field !== "amount" || showAmountIssues),
    );
    return issue === undefined ? null : describe(issue);
  };

  const parsedAmount = parseAmount(amountText);
  const fromEntry = from === null ? undefined : book?.get(from);
  const toEntry = to === null ? undefined : book?.get(to);
  const rate =
    fromEntry !== undefined && toEntry !== undefined && from !== to
      ? fromEntry.price.div(toEntry.price)
      : null;

  const setFrom = useCallback((symbol: string) => {
    setSelection((current) => ({ ...current, from: symbol }));
  }, []);
  const setTo = useCallback((symbol: string) => {
    setSelection((current) => ({ ...current, to: symbol }));
  }, []);

  const flip = useCallback(() => {
    setSelection((current) => ({ from: current.to, to: current.from }));
    setAmountText("");
  }, []);

  const max = useCallback(() => {
    if (from === null) return;
    const balance = balanceOf(coins, from);
    if (balance.gt(0)) setAmountText(formatDecimal(balance));
  }, [from, coins]);

  const submit = useCallback(async () => {
    if (inFlight.current) return; // a second click/Enter while pending must not commit twice
    if (!validation.ok || priceStatus !== "ready" || quote === null || from === null || to === null)
      return;

    inFlight.current = true;
    setSubmitting(true);
    setPendingSwap(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    const request = {
      from,
      to,
      amount: formatDecimal(quote.amount),
      receive: formatDecimal(quote.receive),
    };

    try {
      await backend.submit(request, controller.signal);
      // The wallet changes only now, after the server said yes, and the store re-checks the balance itself.
      const result = commitSwap(request);
      if (result.ok) {
        toast.success(t("swap_success"), {
          description: t("swap_done_detail", {
            amount: formatAmount(quote.amount),
            from,
            receive: formatAmount(quote.receive),
            to,
          }),
        });
        setAmountText("");
        refocusAmount.current = true;
      } else {
        toast.error(t("swap_failed"));
      }
    } catch {
      if (!controller.signal.aborted) toast.error(t("swap_failed"));
    } finally {
      inFlight.current = false;
      controllerRef.current = null;
      setPendingSwap(false);
      if (!controller.signal.aborted) setSubmitting(false);
    }
  }, [validation.ok, priceStatus, quote, from, to, backend, commitSwap, setPendingSwap, t]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  // After a successful swap the amount is cleared, which disables Confirm; without this, keyboard focus would
  // fall back to the page. Focus is only moved when it would otherwise be lost, never taken from somewhere else.
  useEffect(() => {
    if (submitting || !refocusAmount.current) return;
    refocusAmount.current = false;
    const active = document.activeElement;
    const lost =
      active === null ||
      active === document.body ||
      (active instanceof HTMLButtonElement && active.type === "submit");
    if (lost) amountRef.current?.focus();
  }, [submitting, amountRef]);

  return {
    from,
    to,
    amountText,
    setAmountText,
    setFrom,
    setTo,
    flip,
    max,
    submit,
    submitting,
    canSubmit,
    options: entries,
    balances: coins,
    sendUsd: formatUsd(
      parsedAmount.ok && fromEntry !== undefined
        ? parsedAmount.value.mul(fromEntry.price)
        : new D(0),
    ),
    receiveUsd: formatUsd(quote?.toUsd ?? new D(0)),
    receiveText: quote === null ? "" : formatDecimal(quote.receive),
    rateText:
      rate === null || from === null || to === null
        ? null
        : t("rate", { from, to, rate: formatRate(rate) }),
    balanceText: from === null ? null : `${formatAmount(balanceOf(coins, from))} ${from}`,
    fromMessage: messageFor("from"),
    toMessage: messageFor("to"),
    amountMessage: messageFor("amount"),
    formMessage: messageFor("form"),
  };
}
