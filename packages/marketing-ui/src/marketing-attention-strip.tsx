import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";

export type MarketingAttentionTone = "danger" | "warning" | "info";

export type MarketingAttentionStripProps = {
  /** What needs attention, e.g. "Payment due". */
  label: string;
  /** The action, e.g. "Pay now". */
  actionLabel: string;
  href: string;
  tone?: MarketingAttentionTone;
  /** Full sentence read aloud; defaults to "label, actionLabel". */
  accessibleName?: string;
  className?: string;
};

const STRIP_TONE: Record<MarketingAttentionTone, string> = {
  danger: "bg-danger-container text-danger-on-surface",
  warning: "bg-warning-container text-warning-on-surface",
  info: "bg-info-container text-info-on-surface",
};

const CHIP_TONE: Record<MarketingAttentionTone, string> = {
  danger: "border-danger/25 bg-danger-container text-danger-on-surface hover:border-danger/45",
  warning: "border-warning/30 bg-warning-container text-warning-on-surface hover:border-warning/50",
  info: "border-info/30 bg-info-container text-info-on-surface hover:border-info/50",
};

/**
 * The header's one urgent prompt. Below 640px it is a 44px full-width strip under the phone bar
 * ("Payment due · Pay now ›") that scrolls with the page; from 640px it is the inline chip.
 * Both are one link, so exactly one is visible at a time.
 */
export function MarketingAttentionStrip({
  label,
  actionLabel,
  href,
  tone = "warning",
  accessibleName,
  className,
}: MarketingAttentionStripProps) {
  const name = accessibleName ?? `${label}, ${actionLabel}`;
  return (
    <>
      <Link
        href={href}
        aria-label={name}
        data-testid="attention-strip"
        className={cn(
          "flex h-11 w-full items-center justify-center gap-1.5 px-4 font-body text-sm font-medium sm:hidden",
          STRIP_TONE[tone],
          FOCUS_RING,
          className,
        )}
      >
        <span>{label}</span>
        <span aria-hidden>·</span>
        <span className="font-semibold">{actionLabel}</span>
        <span aria-hidden>›</span>
      </Link>
      <Link
        href={href}
        aria-label={name}
        data-testid="attention-chip"
        className={cn(
          "relative hidden h-8 min-w-0 max-w-[17.5rem] items-center gap-1.5 rounded-full border px-3 font-body text-[0.8125rem] font-medium whitespace-nowrap transition-colors sm:inline-flex",
          "after:absolute after:-inset-y-1.5 after:inset-x-0",
          CHIP_TONE[tone],
          FOCUS_RING,
          className,
        )}
      >
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
        <span className="min-w-0 truncate">{label}</span>
      </Link>
    </>
  );
}
