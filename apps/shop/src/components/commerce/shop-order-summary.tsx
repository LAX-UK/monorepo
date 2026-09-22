import { resolveShopFulfilmentLabel } from "@/lib/presenters/shop-fulfilment.presenter";
import { formatGbpPence } from "@/lib/presenters/shop-money.presenter";
import { resolveShopOrderStatusPresentation } from "@/lib/presenters/shop-status-presentation";
import type { OrderSummary } from "@auction/shop-contracts";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";

function formatOrderDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

type Props = {
  order: OrderSummary;
  heading?: string;
  showLineLinks?: boolean;
};

export function ShopOrderSummary({ order, heading, showLineLinks = true }: Props) {
  const status = resolveShopOrderStatusPresentation(order.status);

  return (
    <article className="shop-order-card">
      <header className="shop-order-card__header">
        {heading ? <h2 className="shop-order-card__title">{heading}</h2> : null}
        <p className="shop-order-card__meta">
          <DotStatusPill label={status.label} tone={status.tone} />
          <span>Placed {formatOrderDate(order.createdAt)}</span>
          {order.paidAt ? <span>Paid {formatOrderDate(order.paidAt)}</span> : null}
        </p>
        {status.hint ? <p className="shop-order-card__status-hint">{status.hint}</p> : null}
      </header>

      <dl className="shop-order-card__facts">
        <div>
          <dt>Fulfilment</dt>
          <dd>{resolveShopFulfilmentLabel(order.fulfilment)}</dd>
        </div>
        {order.deliveryAddress ? (
          <div>
            <dt>Delivery address</dt>
            <dd>
              {order.deliveryAddress.line1}
              {order.deliveryAddress.line2 ? (
                <>
                  <br />
                  {order.deliveryAddress.line2}
                </>
              ) : null}
              <br />
              {order.deliveryAddress.city}, {order.deliveryAddress.postcode}
              <br />
              {order.deliveryAddress.country}
            </dd>
          </div>
        ) : null}
      </dl>

      <ul className="shop-order-card__lines">
        {order.lines.map((line) => (
          <li key={line.orderLineId} className="shop-order-card__line">
            <div>
              {showLineLinks ? (
                <Link
                  href={`/artworks/${line.artworkSlug}`}
                  className="shop-order-card__line-title"
                >
                  {line.artworkTitle}
                </Link>
              ) : (
                <span className="shop-order-card__line-title">{line.artworkTitle}</span>
              )}
              <span className="shop-order-card__line-meta">Edition #{line.editionNumber}</span>
            </div>
            <span className="shop-order-card__line-price">
              {formatGbpPence(line.unitPricePence)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="shop-order-card__totals">
        <div>
          <dt>Merchandise</dt>
          <dd>{formatGbpPence(order.merchandiseSubtotalPence)}</dd>
        </div>
        <div>
          <dt>Fulfilment</dt>
          <dd>{formatGbpPence(order.fulfilmentSurchargePence)}</dd>
        </div>
        <div className="shop-order-card__total">
          <dt>Total</dt>
          <dd>{formatGbpPence(order.totalPence)}</dd>
        </div>
      </dl>
    </article>
  );
}
