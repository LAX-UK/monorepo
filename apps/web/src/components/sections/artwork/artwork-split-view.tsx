import { ArtworkImageStage } from "@/components/sections/artwork/artwork-image-stage";
import { RelatedLots } from "@/components/sections/artwork/related-lots";
import { MaterialIcon } from "@/components/ui/material-icon";
import { formatMoney } from "@/lib/format-currency";
import type { Lot } from "@auction/types";
import Link from "next/link";
import type { ReactNode } from "react";

function lotNo(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

type Props = {
  auction: Lot;
  /** When the lot belongs to a sale, show Sales / title in the breadcrumb. */
  parentSale?: { id: string; title: string } | null;
  bidPanel: ReactNode;
  watchSlot?: ReactNode;
  sellerHref: string;
  sellerName: string;
  relatedAuctions: Lot[];
  /** Signed-in user id for “Your listing” on related lots. */
  currentUserId?: string | null;
};

export function ArtworkSplitView({
  auction,
  parentSale = null,
  bidPanel,
  watchSlot,
  sellerHref,
  sellerName,
  relatedAuctions,
  currentUserId = null,
}: Props) {
  const live = auction.status === "active";

  return (
    <main id="main-content" className="flex min-h-screen flex-col pt-24 lg:flex-row lg:pt-0">
      <div className="h-[60vh] w-full overflow-hidden bg-surface-container-low lg:sticky lg:top-24 lg:h-[calc(100vh-6rem)] lg:w-1/2">
        <ArtworkImageStage title={auction.title} images={auction.images} />
      </div>
      <div className="w-full min-w-0 overflow-y-auto overflow-x-hidden px-8 pb-28 pt-8 lg:w-1/2 lg:px-24 lg:pb-20 lg:pt-32">
        <div className="mx-auto min-w-0 max-w-xl lg:mx-0">
          <nav
            aria-label="Breadcrumb"
            className="mb-8 font-label text-xs uppercase tracking-[0.2em] text-secondary"
          >
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="transition-colors hover:text-primary">
                  Gallery
                </Link>
              </li>
              <li aria-hidden className="text-outline-variant">
                /
              </li>
              <li>
                <Link href="/artist/featured" className="transition-colors hover:text-primary">
                  Artists
                </Link>
              </li>
              {parentSale ? (
                <>
                  <li aria-hidden className="text-outline-variant">
                    /
                  </li>
                  <li>
                    <Link href="/sales" className="transition-colors hover:text-primary">
                      Sales
                    </Link>
                  </li>
                  <li aria-hidden className="text-outline-variant">
                    /
                  </li>
                  <li>
                    <Link
                      href={`/sales/${parentSale.id}`}
                      className="transition-colors hover:text-primary"
                    >
                      {parentSale.title}
                    </Link>
                  </li>
                  {auction.lotNumber != null ? (
                    <>
                      <li aria-hidden className="text-outline-variant">
                        /
                      </li>
                      <li className="text-on-surface-variant">Lot {auction.lotNumber}</li>
                    </>
                  ) : null}
                </>
              ) : null}
              <li aria-hidden className="text-outline-variant">
                /
              </li>
              <li className="text-on-surface" aria-current="page">
                {auction.title}
              </li>
            </ol>
          </nav>
          <Link
            href="/"
            className="mb-12 flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-secondary transition-colors hover:text-primary"
          >
            <MaterialIcon name="arrow_back" className="text-sm" />
            Back to gallery
          </Link>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">{watchSlot}</div>
          <div className="mb-12">
            <div className="mb-6 flex items-center gap-3">
              {live ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-error" />
                  </span>
                  <span className="font-label text-xs font-bold uppercase tracking-[0.3em] text-error">
                    Lot pulse • Lot {lotNo(auction.id)}
                  </span>
                </>
              ) : (
                <span className="font-label text-xs font-bold uppercase tracking-[0.3em] text-secondary">
                  {auction.status} • Lot {lotNo(auction.id)}
                </span>
              )}
            </div>
            <h1 className="mb-4 font-headline text-4xl tracking-tight text-on-surface lg:text-6xl">
              {auction.title}
            </h1>
            <p className="mb-2 font-headline text-xl italic text-secondary">
              <Link
                href={sellerHref}
                className="border-b border-transparent transition-colors hover:border-primary hover:text-primary"
              >
                {sellerName}
              </Link>
              <span className="font-body text-sm not-italic text-on-surface-variant">
                {" "}
                · Verified seller
              </span>
            </p>
            <Link
              href={sellerHref}
              className="mb-8 inline-flex items-center gap-1 font-label text-xs font-bold uppercase tracking-widest text-primary"
            >
              View portfolio
              <MaterialIcon name="arrow_forward" className="text-sm" />
            </Link>
            <section
              aria-labelledby="lot-details-heading"
              className="mb-12 rounded-xl bg-surface-container-low/60 p-6 ring-1 ring-outline-variant/15 sm:p-8 dark:bg-surface-container-low/30"
            >
              <h2 id="lot-details-heading" className="sr-only">
                Lot details
              </h2>
              <div className="mb-8 grid grid-cols-2 gap-x-8 gap-y-6 border-b border-outline-variant/15 pb-8 sm:grid-cols-3">
                <div>
                  <span className="mb-1 block font-label text-xs uppercase tracking-widest text-on-surface-variant">
                    Format
                  </span>
                  <span className="text-sm font-medium capitalize text-on-surface">
                    {auction.auctionType.replaceAll("_", " ")}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block font-label text-xs uppercase tracking-widest text-on-surface-variant">
                    Medium
                  </span>
                  <span className="text-sm font-medium text-on-surface">
                    {auction.medium ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block font-label text-xs uppercase tracking-widest text-on-surface-variant">
                    Dimensions
                  </span>
                  <span className="text-sm font-medium text-on-surface">
                    {auction.dimensions ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block font-label text-xs uppercase tracking-widest text-on-surface-variant">
                    Current bid
                  </span>
                  <span className="text-sm font-medium text-on-surface">
                    {formatMoney(auction.currentPrice)}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block font-label text-xs uppercase tracking-widest text-on-surface-variant">
                    Opening bid
                  </span>
                  <span className="text-sm font-medium text-on-surface">
                    {formatMoney(auction.startingPrice)}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block font-label text-xs uppercase tracking-widest text-on-surface-variant">
                    Opens
                  </span>
                  <span className="text-sm font-medium text-on-surface">
                    {formatDateTime(auction.startTime)}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block font-label text-xs uppercase tracking-widest text-on-surface-variant">
                    Closes
                  </span>
                  <span className="text-sm font-medium text-on-surface">
                    {formatDateTime(auction.endTime)}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block font-label text-xs uppercase tracking-widest text-on-surface-variant">
                    Reserve
                  </span>
                  <span className="text-sm font-medium text-on-surface">
                    {auction.reservePrice ? formatMoney(auction.reservePrice) : "Not disclosed"}
                  </span>
                </div>
              </div>
              {auction.description ? (
                <p className="font-body text-base leading-relaxed text-on-surface-variant">
                  {auction.description}
                </p>
              ) : null}
            </section>
          </div>
          <section aria-label="Bidding" className="border-t border-outline-variant/10 pt-10">
            {bidPanel}
          </section>
          <RelatedLots
            auctions={relatedAuctions}
            currentId={auction.id}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </main>
  );
}
