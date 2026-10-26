import { ShopOrderThumbnail } from "@/components/account/shop-order-thumbnail";
import type { ShopOrderLineVm, ShopOrderTotalsVm } from "@/lib/account/shop-orders.vm";
import { cn } from "@auction/ui";
import Link from "next/link";

/** What was bought: image, title, artist, the edition held and the price paid. */
export function ShopOrderLines({ lines }: { lines: readonly ShopOrderLineVm[] }) {
  return (
    <ul className="shop-order-lines">
      {lines.map((line) => (
        <li key={line.id} className="shop-order-lines__line">
          <ShopOrderThumbnail src={line.thumbnailUrl} size={64} />
          <div className="shop-order-lines__copy">
            {line.href ? (
              <Link href={line.href} className="shop-order-lines__title shop-focus-ring">
                {line.title}
              </Link>
            ) : (
              <span className="shop-order-lines__title">{line.title}</span>
            )}
            {line.artist ? <span className="shop-order-lines__meta">{line.artist}</span> : null}
            {line.edition ? <span className="shop-order-lines__meta">{line.edition}</span> : null}
          </div>
          <span className="shop-order-lines__price">{line.priceLabel}</span>
        </li>
      ))}
    </ul>
  );
}

/** Items, delivery and the total, with the VAT included stated once underneath. */
export function ShopOrderTotals({ totals }: { totals: ShopOrderTotalsVm }) {
  return (
    <div className="shop-order-totals">
      <dl className="shop-order-totals__rows">
        {totals.rows.map((row) => (
          <div key={row.label} className={cn(row.emphasis && "is-total")}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {totals.vatLine ? <p className="shop-order-totals__vat">{totals.vatLine}</p> : null}
    </div>
  );
}
