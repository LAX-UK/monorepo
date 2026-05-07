import { formatMoney } from "@/lib/format-currency";
import type { Lot } from "@auction/types";
import Link from "next/link";
import { Fragment } from "react";

type Props = {
  lot: Lot;
  /** Min next bid and sale end (live auction UX preserved) */
  minNextBid: string;
  saleEndLocalLabel: string;
  /** Live current high bid (client state) */
  currentPrice: string;
  /** Inside marketing accordion: hide duplicate title, reduce padding. */
  variant?: "default" | "accordion";
};

/** Figma “LOT DETAILS” block: catalog + reserve + open/close, plus policy links.
 */
export function LotDetailsInline({
  lot,
  minNextBid,
  saleEndLocalLabel,
  currentPrice,
  variant = "default",
}: Props) {
  const embedded = variant === "accordion";
  const specParts = [lot.auctionType.replaceAll("_", " "), lot.medium, lot.dimensions].filter(
    Boolean,
  );

  return (
    <section
      aria-labelledby={embedded ? undefined : "inline-lot-details"}
      className={embedded ? "w-full space-y-4 py-0" : "w-full max-w-[550px] space-y-4 py-8"}
    >
      {embedded ? null : (
        <h2
          id="inline-lot-details"
          className="text-center text-lg font-medium uppercase leading-[21px] text-[#1C170D] dark:text-on-surface"
        >
          Lot details
        </h2>
      )}
      {lot.description ? (
        <p className="whitespace-pre-wrap text-sm leading-[150%] text-[#191919] dark:text-brand-500">
          {lot.description}
        </p>
      ) : null}
      <ul className="space-y-2 text-sm text-[#191919] dark:text-brand-500">
        {specParts.length > 0 ? (
          <li>
            {specParts.map((p, i) => (
              <Fragment key={p}>
                {i > 0 ? " · " : null}
                <span className="capitalize">{p}</span>
              </Fragment>
            ))}
          </li>
        ) : null}
        <li>Opening bid: {formatMoney(lot.startingPrice)}</li>
        <li>Current high bid: {formatMoney(currentPrice)}</li>
        <li>Minimum next bid: {formatMoney(minNextBid)}</li>
        {lot.reservePrice ? (
          <li>Reserve: {formatMoney(lot.reservePrice)}</li>
        ) : (
          <li>Reserve: Not disclosed</li>
        )}
        <li>Closes: {saleEndLocalLabel}</li>
        <li>
          Buyer&apos;s premium: {((Number(lot.buyerPremiumRate) || 0) * 100).toFixed(0)}% on the
          hammer
        </li>
      </ul>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/terms"
          className="text-center text-base font-semibold leading-6 tracking-[0.8px] text-[#050505] underline dark:text-on-surface"
        >
          Conditions of Business
        </Link>
        <Link
          href="/faq"
          className="text-center text-base font-semibold leading-6 tracking-[0.8px] text-[#050505] underline dark:text-on-surface"
        >
          FAQ
        </Link>
        <Link
          href="/shipping"
          className="text-center text-base font-semibold leading-6 tracking-[0.8px] text-[#050505] underline dark:text-on-surface"
        >
          Shipping &amp; Logistics
        </Link>
      </div>
    </section>
  );
}
