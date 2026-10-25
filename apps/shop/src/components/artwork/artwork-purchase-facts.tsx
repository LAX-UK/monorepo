import { MarketingReturnIcon, MarketingTruckIcon } from "@auction/marketing-ui";
import Link from "next/link";

/**
 * Delivery and returns, under the buy button: what delivery costs (the same surcharges checkout
 * charges) and the 14-day right to cancel, each linked to its policy page when that page is live.
 */
export function ArtworkPurchaseFacts({
  deliveryLine,
  returnsLine,
  deliveryHref,
  returnsHref,
}: {
  deliveryLine: string;
  returnsLine: string;
  deliveryHref: string | null;
  returnsHref: string | null;
}) {
  return (
    <ul className="shop-buy__facts">
      <li className="shop-buy__fact">
        <MarketingTruckIcon className="shop-buy__fact-icon" />
        <span className="shop-buy__fact-text">
          <span>{deliveryLine}</span>
          {deliveryHref ? (
            <Link href={deliveryHref} className="shop-inline-link shop-focus-ring">
              Delivery and collection
            </Link>
          ) : null}
        </span>
      </li>
      <li className="shop-buy__fact">
        <MarketingReturnIcon className="shop-buy__fact-icon" />
        <span>
          {returnsHref ? (
            <Link href={returnsHref} className="shop-inline-link shop-focus-ring">
              {returnsLine}
            </Link>
          ) : (
            returnsLine
          )}
        </span>
      </li>
    </ul>
  );
}
