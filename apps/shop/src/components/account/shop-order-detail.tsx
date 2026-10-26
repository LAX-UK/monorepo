import { ShopFinishPaying } from "@/components/account/shop-finish-paying.client";
import { ShopOrderLines, ShopOrderTotals } from "@/components/account/shop-order-lines";
import { ShopOrderTimeline } from "@/components/account/shop-order-timeline";
import { shopButtonClassName } from "@/components/shop-commerce-button";
import { SHOP_POLICY_PATHS } from "@/content/policies/shop-policy-status";
import type { ShopOrderDetailVm } from "@/lib/account/shop-orders.vm";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";

/** Help with an order: the invoice, and reporting a problem while the 14 days are open. */
function OrderHelp({ order }: { order: ShopOrderDetailVm }) {
  const { problem, invoiceHref } = order;
  if (!invoiceHref && !problem) return null;
  return (
    <section className="shop-order-panel" aria-labelledby="order-help-heading">
      <h2 id="order-help-heading" className="shop-order-panel__title">
        Help with this order
      </h2>
      <div className="shop-order-help">
        {invoiceHref ? (
          <div className="shop-order-help__item">
            <Button
              asChild
              variant="outline"
              size="md"
              className={shopButtonClassName("outline", "standard", "shop-order-help__action")}
            >
              <a href={invoiceHref} download>
                Download invoice (PDF)
              </a>
            </Button>
          </div>
        ) : null}
        {problem?.kind === "open" ? (
          <div className="shop-order-help__item">
            <Button
              asChild
              variant="outline"
              size="md"
              className={shopButtonClassName("outline", "standard", "shop-order-help__action")}
            >
              <Link href={problem.href}>Report a problem</Link>
            </Button>
            <p className="shop-order-help__note">
              {problem.until
                ? `You can cancel or report a problem until ${problem.until}.`
                : "You can cancel or report a problem until 14 days after delivery."}
            </p>
          </div>
        ) : null}
        {problem?.kind === "closed" ? (
          <p className="shop-order-help__note">
            {problem.endedOn
              ? `The 14 days to cancel or report a problem ended on ${problem.endedOn}.`
              : "The 14 days to cancel or report a problem have ended."}{" "}
            <Link href={SHOP_POLICY_PATHS.help} className="shop-inline-link shop-focus-ring">
              Contact us
            </Link>{" "}
            if something is wrong.
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The order page. Progress and items on the left; the total, delivery and help on the right from
 * 1024px. Panels sit side by side and never inside one another.
 */
export function ShopOrderDetail({ order }: { order: ShopOrderDetailVm }) {
  return (
    <div className="shop-order-page">
      <div className="shop-order-page__meta">
        <DotStatusPill
          label={order.status.label}
          tone={order.status.tone}
          className="font-supporting"
        />
        <span>{order.placedLabel}</span>
      </div>

      {order.finishPaying ? <ShopFinishPaying order={order.finishPaying} /> : null}

      <div className="shop-order-page__grid">
        <div className="shop-order-page__main">
          {order.timeline ? (
            <section className="shop-order-panel" aria-labelledby="order-progress-heading">
              <h2 id="order-progress-heading" className="shop-order-panel__title">
                Progress
              </h2>
              <ShopOrderTimeline steps={order.timeline} />
            </section>
          ) : order.notice && !order.finishPaying ? (
            <section className="shop-order-panel" aria-labelledby="order-progress-heading">
              <h2 id="order-progress-heading" className="shop-order-panel__title">
                Not paid
              </h2>
              <p className="shop-order-panel__text">{order.notice}</p>
            </section>
          ) : null}

          <section className="shop-order-panel" aria-labelledby="order-items-heading">
            <h2 id="order-items-heading" className="shop-order-panel__title">
              Items
            </h2>
            <ShopOrderLines lines={order.lines} />
          </section>
        </div>

        <div className="shop-order-page__side">
          <section className="shop-order-panel" aria-labelledby="order-summary-heading">
            <h2 id="order-summary-heading" className="shop-order-panel__title">
              Summary
            </h2>
            <ShopOrderTotals totals={order.totals} />
          </section>

          <section className="shop-order-panel" aria-labelledby="order-delivery-heading">
            <h2 id="order-delivery-heading" className="shop-order-panel__title">
              Delivery
            </h2>
            <p className="shop-order-delivery__method">{order.delivery.method}</p>
            {order.delivery.lines.length > 0 ? (
              <address className="shop-order-delivery__address">
                {order.delivery.lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </address>
            ) : null}
          </section>

          <OrderHelp order={order} />
        </div>
      </div>
    </div>
  );
}
