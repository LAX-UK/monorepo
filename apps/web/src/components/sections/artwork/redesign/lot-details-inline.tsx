import { formatMoney } from "@/lib/format-currency";
import { lotShowsBidAction } from "@/lib/lot/lot-bid-action";
import { lotDetailsReserveLine } from "@/lib/lot/reserve-presentation";
import { lotAuctionTypeLabel } from "@/lib/presenters/lot-auction-type-presentation";
import type { Lot, PublicLotView } from "@auction/types";
import Link from "next/link";
import { Fragment } from "react";

type Props = {
  lot: Lot | PublicLotView;
  /** Min next bid and sale end (live auction UX preserved) */
  minNextBid: string;
  saleEndLocalLabel: string;
  /** Live current high bid (client state) */
  currentPrice: string;
  hasReserve: boolean;
  /** Inside marketing accordion: hide duplicate title, reduce padding. */
  variant?: "default" | "accordion";
};

/** Figma “Lot details” block: catalog + reserve + open/close, plus policy links.
 */
export function LotDetailsInline({
  lot,
  minNextBid,
  saleEndLocalLabel,
  currentPrice,
  hasReserve,
  variant = "default",
}: Props) {
  const embedded = variant === "accordion";
  // Once the lot has ended the live figures (next bid, reserve progress) no longer apply.
  const biddingOpen = lotShowsBidAction(lot.status);
  // Medium and size read as the cataloguer wrote them; the auction type is a registry label.
  const specParts = [
    `${lotAuctionTypeLabel(lot.auctionType)} auction`,
    lot.medium,
    lot.dimensions,
  ].filter(Boolean);

  return (
    <section
      aria-labelledby={embedded ? undefined : "inline-lot-details"}
      className={embedded ? "w-full space-y-4 py-0" : "w-full max-w-[550px] space-y-4 py-8"}
    >
      {embedded ? null : (
        <h2
          id="inline-lot-details"
          className="text-center text-lg font-medium leading-[21px] text-on-surface"
        >
          Lot details
        </h2>
      )}
      {lot.description ? (
        <p className="whitespace-pre-wrap text-sm leading-[150%] text-on-surface">
          {lot.description}
        </p>
      ) : null}
      <ul className="space-y-2 text-sm text-on-surface-variant">
        {specParts.length > 0 ? (
          <li>
            {specParts.map((p, i) => (
              <Fragment key={p}>
                {i > 0 ? " · " : null}
                <span>{p}</span>
              </Fragment>
            ))}
          </li>
        ) : null}
        <li>Opening bid: {formatMoney(lot.startingPrice)}</li>
        {biddingOpen ? (
          <>
            <li>Current high bid: {formatMoney(currentPrice)}</li>
            <li>Minimum next bid: {formatMoney(minNextBid)}</li>
            <li>Reserve: {lotDetailsReserveLine(hasReserve)}</li>
          </>
        ) : null}
        <li>
          {biddingOpen ? "Closes" : "Closed"}: {saleEndLocalLabel}
        </li>
        <li>
          Buyer&apos;s premium: {((Number(lot.buyerPremiumRate) || 0) * 100).toFixed(0)}% on the
          hammer
        </li>
      </ul>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/terms"
          className="text-center text-base font-semibold leading-6 tracking-[0.8px] text-on-surface underline"
        >
          Conditions of Business
        </Link>
        <Link
          href="/faq"
          className="text-center text-base font-semibold leading-6 tracking-[0.8px] text-on-surface underline"
        >
          FAQ
        </Link>
        <Link
          href="/shipping"
          className="text-center text-base font-semibold leading-6 tracking-[0.8px] text-on-surface underline"
        >
          Shipping &amp; Logistics
        </Link>
      </div>
    </section>
  );
}
