import { formatCurrencyTotals } from "@/lib/format-money";
import { PRODUCT_LABELS, STATUS_LABELS, STATUS_TONES } from "@/server/domain/portfolio-labels";
import type { CurrencyTotal, LaxPortfolioItemStatus, LaxProductId } from "@auction/lax-ecosystem";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { ProductTag } from "./product-name";

/**
 * The shared badge is all-caps and letter-spaced; these pages write statuses as plain
 * sentences, which are easier to read and do not clip on a narrow screen.
 */
export const SENTENCE_CASE_BADGE =
  "px-2 py-0.5 text-xs leading-5 font-medium normal-case tracking-normal";

/** Which LAX product a work or entry belongs to. The name keeps its own capitalisation. */
export function ProductBadge({ product }: { product: LaxProductId }) {
  return <ProductTag product={product}>{PRODUCT_LABELS[product]}</ProductTag>;
}

export function PortfolioStatusBadge({ status }: { status: LaxPortfolioItemStatus }) {
  return (
    <StatusBadge variant={STATUS_TONES[status]} className={SENTENCE_CASE_BADGE}>
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
 * The work's image, or an empty frame when there is none. The alt text is empty because the
 * title is always printed beside it.
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
    <span
      aria-hidden="true"
      className={`${className} block rounded-lg border border-border-hairline bg-surface-container`}
    />
  );
}
