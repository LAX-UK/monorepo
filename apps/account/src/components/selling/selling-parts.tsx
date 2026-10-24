import { Button } from "@/components/account-button";
import { CARD, CARD_PADDING, NOTICE, NoticeTitle } from "@/components/account-ui";
import { formatMinorUnits } from "@/lib/format-money";
import type { SellingTabVm } from "@/server/domain/selling/selling-routes";
import { cn } from "@auction/ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Skeleton } from "@auction/ui/components/skeleton";
export type SellingStatusTone = "success" | "info" | "warning" | "neutral" | "danger";

/**
 * Filled badges in Account's status colours. Text sits on the matching container in its
 * darkest readable colour, so every tone clears 4.5:1 in light and dark.
 */
const STATUS_TONE: Record<SellingStatusTone, string> = {
  success: "bg-success-container text-on-success-container",
  info: "bg-info-container text-on-surface",
  warning: "bg-warning-container text-on-surface",
  neutral: "bg-surface-container-high text-on-surface-variant",
  danger: "bg-error-container text-on-error-container",
};

/** A state in words, as a filled badge in one shape across the Selling pages. */
export function SellingStatus({
  label,
  tone,
  className,
}: {
  label: string;
  tone: SellingStatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs leading-5 font-medium whitespace-nowrap",
        STATUS_TONE[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Shop records seller money in pounds. */
export const formatPence = (pence: number) => formatMinorUnits(pence, "GBP");

/** Table rows in a card, with hairline dividers and the card's own side padding. */
export const ROW = "border-b border-border-hairline hover:bg-transparent";
export const EDGE = "px-3 first:pl-4 last:pr-4 sm:first:pl-6 sm:last:pr-6";
export const CELL = `${EDGE} py-3`;

/** Money in a column: right-aligned with figures of one width, so amounts line up. */
export const MONEY = "text-right tabular-nums whitespace-nowrap";

/**
 * The tabs across the Selling pages. Each is a link (the pages are separate URLs), marked with
 * `aria-current` and an underline in the product accent, so colour is not the only cue.
 */
export function SellingTabs({ tabs }: { tabs: SellingTabVm[] }) {
  if (tabs.length === 0) return null;
  return (
    <nav aria-label="Selling" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-6 border-b border-border-hairline">
        {tabs.map((tab) => (
          <li key={tab.tool}>
            <a
              href={tab.href}
              aria-current={tab.current ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 items-center rounded-t-sm border-b-2 text-sm transition-colors",
                tab.current
                  ? "border-product-accent font-semibold text-on-surface"
                  : "border-transparent font-medium text-on-surface-variant hover:border-control-border hover:text-on-surface",
              )}
            >
              {tab.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Shown in place of a section Shop could not answer for. Retry reloads the page, which works
 * without client JavaScript, and nothing else on the page is hidden by it.
 */
export function SellingLoadError({
  title,
  retryHref,
}: {
  title: string;
  retryHref: string;
}) {
  return (
    <Alert variant="warning" className={cn(NOTICE, "flex flex-col items-start gap-3")}>
      <div className="flex flex-col gap-1">
        <NoticeTitle>{title}</NoticeTitle>
        <AlertDescription>
          LAX Shop didn't answer in time. Nothing has changed; please try again in a moment.
        </AlertDescription>
      </div>
      <Button asChild variant="outline">
        <a href={retryHref}>Try again</a>
      </Button>
    </Alert>
  );
}

/** A figure with its label, as in the totals above a list. */
export function SellingStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-sm text-on-surface-variant">{label}</dt>
      <dd className="font-headline text-2xl font-semibold tabular-nums text-on-surface">{value}</dd>
      {hint ? <dd className="text-xs text-on-surface-variant">{hint}</dd> : null}
    </div>
  );
}

export function SellingStats({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <dl
      aria-label={label}
      className={cn(CARD, CARD_PADDING, "grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4")}
    >
      {children}
    </dl>
  );
}

/** Placeholder rows while a list loads, in the shape of the card that will replace them. */
export function SellingListSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <output aria-label={label} className={cn(CARD, "block divide-y divide-border-hairline")}>
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
        <div key={index} className="flex items-center gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-11 w-28 rounded-md" />
        </div>
      ))}
    </output>
  );
}

export function SellingStatsSkeleton({ label }: { label: string }) {
  return (
    <output
      aria-label={label}
      className={cn(CARD, CARD_PADDING, "grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4")}
    >
      {Array.from({ length: 4 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </output>
  );
}
