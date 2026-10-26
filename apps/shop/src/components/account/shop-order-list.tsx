import { ShopOrderThumbnail } from "@/components/account/shop-order-thumbnail";
import type { ShopOrderRowVm } from "@/lib/account/shop-orders.vm";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";

/** Placed orders, newest first. Each row opens the order; the title link covers the row. */
export function ShopOrderList({ rows }: { rows: readonly ShopOrderRowVm[] }) {
  return (
    <table className="shop-orders-table">
      <caption className="sr-only">Your orders, newest first</caption>
      <thead>
        <tr>
          <th scope="col">Order</th>
          <th scope="col">Placed</th>
          <th scope="col">Total</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.orderId} className="shop-orders-table__row">
            <td className="shop-orders-table__order">
              <div className="shop-orders-table__item">
                <ShopOrderThumbnail src={row.thumbnailUrl} size={48} />
                <div className="shop-orders-table__names">
                  <Link href={row.href} className="shop-orders-table__link">
                    {row.title}
                  </Link>
                  <span className="shop-orders-table__reference">{row.reference}</span>
                </div>
              </div>
            </td>
            <td className="shop-orders-table__placed">
              <time dateTime={row.placedAt}>{row.placedLabel}</time>
            </td>
            <td className="shop-orders-table__total">
              <span>{row.totalLabel}</span>
              {row.refundLabel ? (
                <span className="shop-orders-table__refund">{row.refundLabel}</span>
              ) : null}
            </td>
            <td className="shop-orders-table__status">
              <DotStatusPill
                label={row.status.label}
                tone={row.status.tone}
                className="font-supporting"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
