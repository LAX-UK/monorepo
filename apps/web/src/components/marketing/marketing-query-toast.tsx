"use client";

import { Button, cn } from "@auction/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

export type MarketingQueryToastProps = {
  /** Query param name, e.g. `welcome` or `auth`. */
  param: string;
  /** Param value that shows the toast (e.g. `back` for `welcome=back`). */
  whenValue: string;
  durationMs?: number;
  className?: string;
  children: React.ReactNode;
  /** Optional dismiss control label. */
  dismissLabel?: string;
};

function MarketingQueryToastInner({
  param,
  whenValue,
  durationMs = 8000,
  className,
  children,
  dismissLabel = "Dismiss",
}: MarketingQueryToastProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const stripParam = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (!next.has(param)) return;
    next.delete(param);
    const qs = next.toString();
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [param, router, searchParams]);

  useEffect(() => {
    clearHideTimer();
    if (searchParams.get(param) !== whenValue) {
      setOpen(false);
      return;
    }
    setOpen(true);
    hideTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      stripParam();
    }, durationMs);
    return () => clearHideTimer();
  }, [clearHideTimer, durationMs, param, searchParams, stripParam, whenValue]);

  if (!open) return null;

  const dismiss = () => {
    clearHideTimer();
    setOpen(false);
    stripParam();
  };

  return (
    <output
      className={cn(
        "fixed bottom-6 left-1/2 z-[60] block w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-lg border border-border-hairline bg-inverse-surface px-4 py-3 text-inverse-on-surface shadow-lg",
        className,
      )}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-sm">{children}</div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-inverse-on-surface"
          onClick={dismiss}
        >
          {dismissLabel}
        </Button>
      </div>
    </output>
  );
}

export function MarketingQueryToast(props: MarketingQueryToastProps) {
  return (
    <Suspense fallback={null}>
      <MarketingQueryToastInner {...props} />
    </Suspense>
  );
}
