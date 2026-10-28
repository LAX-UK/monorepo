import type { DeliveryEstimateVm } from "@/lib/presenters/delivery-estimate.presenter";
import { MarketingReturnIcon, MarketingTruckIcon } from "@auction/marketing-ui";
import Link from "next/link";

/**
 * Delivery and returns, under the buy button. With delivery times configured, delivery is dated
 * ("Arrives Mon 2 Nov – Wed 4 Nov") with the collection alternative under it; otherwise it states
 * what delivery costs. Both come from the same rules checkout uses, and each line links to its
 * policy page when that page is live.
 */
export function ArtworkPurchaseFacts({
  deliveryLine,
  deliveryEstimate = null,
  returnsLine,
  deliveryHref,
  returnsHref,
}: {
  deliveryLine: string;
  deliveryEstimate?: DeliveryEstimateVm | null;
  returnsLine: string;
  deliveryHref: string | null;
  returnsHref: string | null;
}) {
  return (
    <ul className="shop-buy__facts">
      <li className="shop-buy__fact">
        <MarketingTruckIcon className="shop-buy__fact-icon" />
        <span className="shop-buy__fact-text">
          {deliveryEstimate ? (
            <>
              <span className="shop-buy__fact-strong">{deliveryEstimate.delivery}</span>
              {deliveryEstimate.collection ? (
                <span className="shop-buy__fact-quiet">{deliveryEstimate.collection}</span>
              ) : null}
            </>
          ) : (
            <span>{deliveryLine}</span>
          )}
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
