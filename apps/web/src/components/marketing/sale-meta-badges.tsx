import { SaleLifecycleBadge } from "@/components/marketing/sale-lifecycle-badge";
import { SaleScheduleBadges } from "@/components/marketing/sale-status-badge";
import { SaleTypeBadge } from "@/components/marketing/sale-type-badge";
import type { SaleFormatExplainerContext } from "@/lib/sale-format-explainer";
import type { Sale, SaleDeliveryMode } from "@auction/types";
import { cn } from "@auction/ui";

type Props = {
  status: Sale["status"] | "voided";
  deliveryMode: SaleDeliveryMode;
  dateLabel: string;
  isLive: boolean;
  startsSoon?: boolean;
  locationLabel?: string | null;
  /** When true, render `SaleScheduleBadges` above the meta row (home tiles). */
  withScheduleRow?: boolean;
  /** When false, lifecycle badge is omitted (caller renders status elsewhere). */
  showLifecycleBadge?: boolean;
  withExplainer?: boolean;
  explainerContext?: SaleFormatExplainerContext;
  /** Hybrid + gated online bidding — small inline hint. */
  showOnlineBiddingGatedBadge?: boolean;
  /** When false, omit the date divider (hero shows date in a separate line). */
  showDate?: boolean;
  size?: "sm" | "md";
  className?: string;
};

/** Shared lifecycle + format + date meta row for sale cards and hero. */
export function SaleMetaBadges({
  status,
  deliveryMode,
  dateLabel,
  isLive,
  startsSoon = false,
  locationLabel,
  withScheduleRow = false,
  showLifecycleBadge = true,
  withExplainer = false,
  explainerContext,
  showOnlineBiddingGatedBadge = false,
  showDate = true,
  size = "sm",
  className,
}: Props) {
  const showRegistryLifecycle =
    showLifecycleBadge && (status === "active" || status === "scheduled" || status === "ended");
  const dateClass =
    size === "sm"
      ? "font-body text-xs font-normal uppercase leading-snug text-on-surface-variant sm:text-sm"
      : "font-body text-xs font-normal uppercase text-on-surface-variant sm:text-sm";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {withScheduleRow ? <SaleScheduleBadges isLive={isLive} startsSoon={startsSoon} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        {!withScheduleRow && showRegistryLifecycle ? (
          <SaleLifecycleBadge status={status} size={size} />
        ) : null}
        {!withScheduleRow && startsSoon && !isLive && status === "scheduled" ? (
          <SaleLifecycleBadge status="scheduled" label="Starts soon" size={size} />
        ) : null}
        <SaleTypeBadge
          deliveryMode={deliveryMode}
          size={size}
          isLive={isLive}
          withExplainer={withExplainer}
          {...(explainerContext ? { explainerContext } : {})}
        />
        {showOnlineBiddingGatedBadge ? (
          <span className="inline-flex items-center rounded border border-outline-variant/50 bg-surface-container-low px-2 py-0.5 font-label text-[0.6rem] font-semibold uppercase tracking-wider text-on-surface-variant">
            Online bidding opens when live
          </span>
        ) : null}
        {showDate ? (
          <div
            className={cn(
              "flex min-h-[1em] items-center self-stretch border-l border-on-surface-variant pl-2",
              size === "sm" ? "" : "border-on-surface-variant/20 pl-2.5",
            )}
          >
            <span className={dateClass}>{dateLabel}</span>
          </div>
        ) : null}
        {locationLabel ? (
          <div className="flex min-h-[1.25em] items-center border-l border-on-surface-variant/20 pl-2.5">
            <span className={dateClass}>{locationLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
