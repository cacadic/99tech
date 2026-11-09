import { useState } from "react";
import { tokenIconUrl } from "@/shared/lib/tokenIcons";
import { cn } from "@/shared/lib/utils";

interface TokenIconProps {
  symbol: string;
  className?: string;
}

/** Decorative token logo (the symbol is always rendered next to it). Falls back to the initial letter. */
export function TokenIcon({ symbol, className }: TokenIconProps) {
  const url = tokenIconUrl(symbol);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (url === undefined || failedUrl === url) {
    return (
      <span
        aria-hidden="true"
        data-testid="token-icon-fallback"
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full bg-blue-base text-sm font-semibold text-blue-500",
          className,
        )}
      >
        {symbol.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      width={32}
      height={32}
      decoding="async"
      onError={() => {
        setFailedUrl(url);
      }}
      className={cn("size-8 shrink-0 rounded-full", className)}
    />
  );
}
