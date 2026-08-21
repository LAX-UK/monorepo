import type { BidErrorPresentation, BidErrorSeverity } from "@/lib/ui/bid-error";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

const severityClass: Record<BidErrorSeverity, string> = {
  error: "text-error",
  info: "text-on-surface",
  warning: "text-[color:var(--color-tertiary,#b45309)] dark:text-orange-300",
};

const bannerToneClass: Record<BidErrorSeverity, string> = {
  error: "border-error/30 bg-error-container/20 ring-error/20 text-on-surface",
  info: "border-outline-variant/40 bg-surface-container-high/60 ring-outline-variant/20 text-on-surface",
  warning:
    "border-lot-orange/30 bg-lot-orange/10 ring-lot-orange/20 text-on-surface dark:text-on-surface",
};

export function BidErrorView({
  error,
  className,
  variant = "inline",
  onAction,
}: {
  error: BidErrorPresentation | null;
  className?: string;
  variant?: "inline" | "banner";
  onAction?: (actionKey: NonNullable<BidErrorPresentation["actionKey"]>) => void;
}) {
  if (!error) return null;
  const tone = severityClass[error.severity];
  const actionHref = error.actionHref;
  const actionKey = error.actionKey;
  const showActionButton = Boolean(actionKey && onAction);
  const showActionLink = Boolean(actionHref && !showActionButton);

  return (
    <div
      className={cn(
        variant === "banner"
          ? cn("rounded-lg border px-4 py-3 ring-1", bannerToneClass[error.severity])
          : null,
        className,
      )}
      role="alert"
    >
      {error.title ? (
        <p
          className={cn(
            "font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
            tone,
          )}
        >
          {error.title}
        </p>
      ) : null}
      <p className={cn("text-sm", tone, error.title ? "mt-1" : null)}>{error.message}</p>
      {showActionLink && actionHref ? (
        <Link
          href={actionHref}
          className={cn("mt-2 inline-block text-sm font-medium underline underline-offset-2", tone)}
        >
          {error.actionLabel ?? "Continue"}
        </Link>
      ) : null}
      {showActionButton && actionKey ? (
        <Button
          type="button"
          variant="link"
          size="link"
          onClick={() => onAction?.(actionKey)}
          className={cn("mt-2 h-auto p-0 text-sm font-medium underline underline-offset-2", tone)}
        >
          {error.actionLabel ?? "Continue"}
        </Button>
      ) : null}
    </div>
  );
}
