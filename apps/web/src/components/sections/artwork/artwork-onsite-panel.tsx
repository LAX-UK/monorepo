import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
import { formatMoney } from "@/lib/format-currency";
import type { Lot, Sale } from "@auction/types";
import {
  formatPostalAddressLines,
  hasStructuredAddress,
  resolveOnsiteMapUrl,
} from "@auction/validators";

type Props = {
  auction: Lot;
  sale: Sale;
  summarySeed: LotSummarySeedVM;
};

/** Read-only marketing panel for lots inside an onsite (in-person) auction.
 * * Onsite sales are catalog-only and do not accept bids on the website. We
 * intentionally render a different component than {@link ArtworkBidPanel} so
 * the bid controls, BidGate, and realtime bid hooks are not even mounted for
 * these lots (Single Responsibility / Liskov: each panel renders one mode).
 */
export function ArtworkOnsitePanel({ auction, sale, summarySeed }: Props) {
  const eventStartLabel = new Date(sale.startTime).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const eventEndLabel = new Date(sale.endTime).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="min-w-0 max-w-[550px]">
      <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-6 shadow-[0_1px_0_rgba(0,0,0,0.04)] lg:p-7 dark:bg-surface-container-low/40">
        <span className="inline-block rounded-full bg-secondary-container/40 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-on-secondary-container">
          Onsite auction · catalog
        </span>

        <div className="mt-4 space-y-3">
          <div>
            <p className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
              Estimate
            </p>
            <p className="mt-1 font-body text-lg text-on-surface">
              {summarySeed.estimateLine ?? "—"}
            </p>
          </div>
          {auction.startingPrice ? (
            <div>
              <p className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
                Opening price
              </p>
              <p className="mt-1 font-body text-lg text-on-surface">
                {formatMoney(auction.startingPrice)}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <h3 className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
              Auction event
            </h3>
            <p className="mt-1 font-body text-sm text-on-surface">
              {eventStartLabel} — {eventEndLabel}
            </p>
          </div>

          {(() => {
            const addressLines = formatPostalAddressLines(sale);
            const hasStructured = hasStructuredAddress(sale);
            const mapsUrl = resolveOnsiteMapUrl(sale);
            const showSection = sale.locationName || addressLines.length > 0 || mapsUrl;
            if (!showSection) return null;
            return (
              <div>
                <h3 className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
                  Location
                </h3>
                {sale.locationName ? (
                  <p className="mt-1 font-body text-sm text-on-surface">{sale.locationName}</p>
                ) : null}
                {addressLines.length > 0 ? (
                  <address className="mt-1 font-body text-sm not-italic text-on-surface-variant">
                    {addressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                ) : null}
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex font-label text-xs font-bold uppercase tracking-widest text-primary underline"
                    aria-label={
                      hasStructured ? "Get directions in Google Maps" : "Open venue location"
                    }
                  >
                    {sale.locationMapUrl ? "Open map" : "Get directions"}
                  </a>
                ) : null}
              </div>
            );
          })()}

          {sale.streamUrl ? (
            <div>
              <h3 className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
                Live stream
              </h3>
              <a
                href={sale.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex font-label text-xs font-bold uppercase tracking-widest text-primary underline"
              >
                Watch live
              </a>
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-on-surface-variant">
          Bidding takes place in person at the venue or via a registered representative. Online
          bidding is not available for this lot.
        </p>
      </div>
    </div>
  );
}
