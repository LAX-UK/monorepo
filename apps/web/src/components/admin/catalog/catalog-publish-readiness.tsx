"use client";

import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { cn } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { CheckCircle2, Circle, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  title: string;
  readiness: CatalogReadinessResult;
  /** localStorage key for dismiss persistence */
  dismissKey?: string;
  compact?: boolean;
  onDismiss?: () => void;
};

export function CatalogPublishReadiness({
  title,
  readiness,
  dismissKey,
  compact = false,
  onDismiss,
}: Props) {
  const storageKey = dismissKey ? `catalog-readiness-dismiss:${dismissKey}` : null;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      setDismissed(window.localStorage.getItem(storageKey) === "1");
    } catch {
      // ignore
    }
  }, [storageKey]);

  if (readiness.percent === 100) return null;
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, "1");
      } catch {
        // ignore
      }
    }
    onDismiss?.();
  };

  if (compact) {
    return (
      <div className="space-y-2 border-t border-border-hairline/60 pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-label text-[10px] uppercase tracking-wide text-secondary">
            Catalog readiness
          </p>
          <span className="font-body text-xs tabular-nums text-on-surface-variant">
            {readiness.percent}%
          </span>
        </div>
        {readiness.firstFailing ? (
          <Link
            href={readiness.firstFailing.href ?? "#"}
            className="block font-body text-xs text-primary hover:underline"
          >
            Fix: {readiness.firstFailing.label} →
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <Alert variant="default" className="relative border-warning/40 bg-warning/5">
      <AlertTitle className="flex items-center justify-between gap-2 pr-8">
        <span>
          {title} — {readiness.percent}% ready
        </span>
        {storageKey ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 size-8"
            onClick={dismiss}
            aria-label="Dismiss readiness checklist"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1.5">
          {readiness.items.map((item) => (
            <li key={item.id}>
              {item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-start gap-2 text-sm hover:underline",
                    item.ok ? "text-on-surface-variant" : "text-on-surface",
                  )}
                >
                  <ReadinessIcon ok={item.ok} severity={item.severity} />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={cn(
                    "flex items-start gap-2 text-sm",
                    item.ok ? "text-on-surface-variant" : "text-on-surface",
                  )}
                >
                  <ReadinessIcon ok={item.ok} severity={item.severity} />
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function ReadinessIcon({
  ok,
  severity,
}: {
  ok: boolean;
  severity: "required" | "warning";
}) {
  if (ok) {
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />;
  }
  return (
    <Circle
      className={cn(
        "mt-0.5 size-4 shrink-0",
        severity === "required" ? "text-danger" : "text-warning",
      )}
      aria-hidden
    />
  );
}
