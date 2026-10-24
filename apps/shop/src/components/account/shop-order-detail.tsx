import { ShopOrderThumbnail } from "@/components/account/shop-order-thumbnail";
import type { ShopOrderDetailVm } from "@/lib/account/shop-orders.vm";
import { cn } from "@auction/ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";

/** Items on the left; status, delivery and totals on the right from 1024px. */
export function ShopOrderDetail({ order }: { order: ShopOrderDetailVm }) {
  return (
    <div className="shop-order-detail">
      <section className="shop-order-detail__items" aria-labelledby="order-items-heading">
        <h2 id="order-items-heading" className="shop-account__section-title">
          Items
        </h2>
        <ul className="shop-order-detail__lines">
          {order.lines.map((line) => (
            <li key={line.id} className="shop-order-detail__line">
              <ShopOrderThumbnail src={line.thumbnailUrl} size={64} />
              <div className="shop-order-detail__line-copy">
                {line.href ? (
                  <Link href={line.href} className="shop-order-detail__line-title shop-focus-ring">
                    {line.title}
                  </Link>
                ) : (
                  <span className="shop-order-detail__line-title">{line.title}</span>
                )}
                {line.detail ? (
                  <span className="shop-order-detail__line-meta">{line.detail}</span>
                ) : null}
              </div>
              <span className="shop-order-detail__line-price">{line.priceLabel}</span>
            </li>
          ))}
        </ul>
      </section>

      <aside className="shop-order-detail__summary" aria-labelledby="order-summary-heading">
        <h2 id="order-summary-heading" className="shop-account__section-title">
          Summary
        </h2>
        <div className="shop-order-detail__status">
          <DotStatusPill
            label={order.status.label}
            tone={order.status.tone}
            className="font-supporting"
          />
          {order.status.hint ? (
            <p className="shop-order-detail__hint">{order.status.hint}</p>
          ) : null}
        </div>
        <dl className="shop-order-detail__facts">
          <div>
            <dt>Placed</dt>
            <dd>{order.placedLabel}</dd>
          </div>
          {order.paidLabel ? (
            <div>
              <dt>Paid</dt>
              <dd>{order.paidLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt>Delivery</dt>
            <dd>{order.fulfilmentLabel}</dd>
          </div>
          {order.addressLines ? (
            <div>
              <dt>Address</dt>
              <dd>
                {order.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
        <dl className="shop-order-detail__totals">
          {order.totals.map((row) => (
            <div key={row.label} className={cn(row.emphasis && "is-total")}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
