import { formatCurrencyTotals } from "@/lib/format-money";
import { PRODUCT_LABELS, STATUS_LABELS, STATUS_STYLES } from "@/server/domain/portfolio-labels";
import type { CurrencyTotal, LaxPortfolioItemStatus, LaxProductId } from "@auction/lax-ecosystem";
import { MediaPlaceholder } from "@auction/ui/components/media-placeholder";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { ProductName } from "./product-name";

/** Which LAX product a work or entry belongs to. The name keeps its own capitalisation. */
export function ProductBadge({ product }: { product: LaxProductId }) {
  // Plain coloured text, not a pill, so the product never reads as another status badge.
  return (
    <ProductName product={product} className="text-sm whitespace-nowrap">
      {PRODUCT_LABELS[product]}
    </ProductName>
  );
}

export function PortfolioStatusBadge({ status }: { status: LaxPortfolioItemStatus }) {
  const { tone, cue } = STATUS_STYLES[status];
  return (
    <StatusBadge tone={tone} shape={cue}>
      {STATUS_LABELS[status]}
    </StatusBadge>
  );
}

/** One figure per currency, side by side. "None recorded" is shown instead of a zero. */
export function CurrencyAmounts({ totals }: { totals: readonly CurrencyTotal[] }) {
  if (totals.length === 0) return <span className="text-on-surface-variant">None recorded</span>;
  return <span className="tabular-nums">{formatCurrencyTotals(totals)}</span>;
}

/**
 * The work's image, or the established hatched placeholder when there is none. Both are hidden from
 * assistive technology because the title is always printed beside them.
 */
export function WorkThumbnail({
  src,
  className,
}: {
  src: string | null;
  className: string;
}) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={`${className} rounded-lg object-cover`} />
  ) : (
    <span aria-hidden="true" className={`${className} relative block overflow-hidden rounded-lg`}>
      <MediaPlaceholder fill />
    </span>
  );
}
