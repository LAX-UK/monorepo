import type { ArtworkProductPageVm } from "@/lib/artwork/artwork-product-page.vm";
import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The buy column, top to bottom: the eyebrow from the facts, the title with its year, the artist
 * as a link and one line about the print. The price, the action and the delivery line follow as
 * `children`, whatever the edition's state.
 */
export function ArtworkBuyColumn({
  vm,
  children,
}: {
  vm: Pick<
    ArtworkProductPageVm,
    "eyebrow" | "heading" | "year" | "artistName" | "artistHref" | "metaLine"
  >;
  children: ReactNode;
}) {
  return (
    <div className="shop-edition-buy">
      <header className="shop-edition-buy__heading">
        {vm.eyebrow ? <p className="shop-product__eyebrow">{vm.eyebrow}</p> : null}
        <h1 className="shop-product__title">
          {vm.heading}
          {vm.year != null ? <span className="shop-edition-buy__year">, {vm.year}</span> : null}
        </h1>
        <p className="shop-product__artist">
          <Link href={vm.artistHref} className={cn("shop-inline-link", FOCUS_RING)}>
            {vm.artistName}
          </Link>
        </p>
        {vm.metaLine ? <p className="shop-edition-buy__meta">{vm.metaLine}</p> : null}
      </header>
      {children}
    </div>
  );
}

/** The price and VAT note shared by every state of the buy column. */
export function ArtworkPriceBlock({
  priceLabel,
  vatNote,
}: { priceLabel: string; vatNote: string }) {
  return (
    <div className="shop-buy__price">
      <p className="shop-buy__amount">{priceLabel}</p>
      <p className="shop-buy__vat">{vatNote}</p>
    </div>
  );
}
